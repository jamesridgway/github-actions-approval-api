const azureBodyParser = require("./middleware/azure-body-parser");
const axios = require("axios");
const express = require("express");

const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

const credential = new DefaultAzureCredential();
const account = process.env.GHA_STORAGE_ACCOUNT;
const tableName = process.env.GHA_TABLE_NAME;
const websiteHostname = process.env.WEBSITE_HOSTNAME;
const githubUsername = process.env.AUTH_GITHUB_USERNAME;
const githubToken = process.env.AUTH_GITHUB_TOKEN;

const client = new TableClient(
  `https://${account}.table.core.windows.net`,
  tableName,
  credential
);
const { v4: uuidv4 } = require("uuid");

const app = express();

if (process.env.FUNCTIONS_WORKER_RUNTIME === undefined) {
  console.log("Running locally");
  app.use(express.json());
} else {
  console.log("Running in Azure");
  app.use(azureBodyParser());
}

app.get("/api", (req, res) => {
  console.log(process.env);
  res.json({
    ok: true,
  });
});

app.post("/api/approval", async (req, res) => {
  const repositoryFullName = req.body.repositoryFullName;
  const commitHash = req.body.commitHash;
  const workflowIdToTrigger = req.body.workflowIdToTrigger;
  const webhookUrl = req.body.webhookUrl;
  const approvalId = uuidv4();
  const token = uuidv4();

  console.log(
    `Triggered by ${repositoryFullName} at commit ${commitHash}. Prompt to kick off workflow ${workflowIdToTrigger}`
  );

  const partitionKey = repositoryFullName.replace("/", "_");

  try {
    await client.createEntity({
      partitionKey,
      rowKey: approvalId,
      repositoryFullName,
      commitHash,
      workflowIdToTrigger,
      webhookUrl,
      token,
    });
  } catch (ex) {
    console.log('Failed to create entity in table storage', ex);
    res.json({error: 'internal-server'}).status(500);
    return;
  }

  const actionUrl = `https://${websiteHostname}/api/approval/${partitionKey}/${approvalId}?token=${token}`;

  const webhookPayload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "0076D7",
    summary: `Deploy ${repositoryFullName}?`,
    sections: [
      {
        activityTitle: `Do you want to deploy ${repositoryFullName}?`,
        activitySubtitle: `The latest commit is ${commitHash}`,
        facts: [
          {
            name: "Commit",
            value: commitHash,
          },
        ],
        markdown: true,
      },
    ],
    potentialAction: [
      {
        "@type": "HttpPOST",
        name: "Deploy",
        target: actionUrl,
      },
    ],
  };
  const response = await axios.post(webhookUrl, webhookPayload);
  console.log(`Webhook responded with a ${response.status} response`);

  res.json({
    id: approvalId,
  });
});

app.post("/api/approval/:partition_key/:approval_id", async (req, res) => {
  const partitionKey = req.params.partition_key;
  const rowKey = req.params.approval_id;

  try {
    const approval = await client.getEntity(partitionKey, rowKey);
    if (approval.token != req.query.token) {
      res.json({ error: 'not-found' }).status(404);
      return;
    }

    const triggerWorkflowUrl = `https://api.github.com/repos/${approval.repositoryFullName}/actions/workflows/${approval.workflowIdToTrigger}/dispatches`;
    const workflowPayload = {
      ref: 'main',
      inputs: {
        commit: approval.commitHash
      }
    };
    const response = await axios.post(triggerWorkflowUrl, workflowPayload, {
      auth: {
        username: githubUsername,
        password: githubToken
      }});
    console.log(`GitHub workflow dispatch trigger responded with a ${response.status} response`);
    res.json({
      id: rowKey,
      success: response.status == 200
    });
  } catch (ex) {
    console.log(ex);
  }
  res.json({ error: 'not-found' }).status(404);
});

module.exports = app;
