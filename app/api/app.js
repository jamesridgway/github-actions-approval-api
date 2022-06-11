const azureBodyParser = require("./middleware/azure-body-parser");
const axios = require("axios");
const express = require("express");

const { TableClient } = require("@azure/data-tables");
const { DefaultAzureCredential } = require("@azure/identity");

const credential = new DefaultAzureCredential();
const account = process.env.GHA_STORAGE_ACCOUNT;
const tableName = process.env.GHA_TABLE_NAME;
const websiteHostname = process.env.WEBSITE_HOSTNAME;

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

  await client.createEntity({
    partitionKey: repositoryFullName.replace("/", "_"),
    rowKey: approvalId,
    commitHash,
    workflowIdToTrigger,
    webhookUrl,
    token,
  });

  const actionUrl = `https://${websiteHostname}/api/approval/${approvalId}?token=${token}`;

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
  console.log(webhookPayload);
  const response = await axios.post(webhookUrl, webhookPayload);
  console.log(`Webhook responded with a ${response.status} response`);

  res.json({
    id: approvalId,
  });
});

app.post("/api/approval/:approval_id", (req, res) => {
  res.json({
    approval_id: req.params.approval_id,
  });
});

module.exports = app;
