const bodyParser = require('body-parser');
const express = require("express");
const axios = require('axios');


const app = express();
app.use(bodyParser.json())


app.get("/api", (req, res) => {
  res.json({
    ok: true,
  });
});

app.post("/api/approval", (req, res) => {
  console.log(req.body);
  const repositoryFullName = req.body.repositoryFullName;
  const commitHash = req.body.commitHash;
  const workflowIdToTrigger = req.body.workflowIdToTrigger;
  const webhookUrl = req.body.webhookUrl;

  const webhookPayload = {
    text: `Triggered by ${repositoryFullName} at commit ${commitHash}. Prompt to kick off workflow ${workflowIdToTrigger}`
  }
  axios.post(webhookUrl, webhookPayload)
    .then(response => console.log(`Webhook responded with a ${response.status} response`))
    .catch(error => console.error('There was an error ', error));

  res.json({
    ok: true,
    desc: 'Approval requested'
  });
});


app.post("/api/approval/:approval_id", (req, res) => {
  res.json({
    approval_id: req.params.approval_id
  });
});

module.exports = app;
