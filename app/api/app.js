const express = require("express");
const axios = require('axios');

const app = express();

app.get("/api", (req, res) => {
  const repositoryFullName = req.body.repositoryFullName;
  const commitHash = req.body.commitHash;
  const workflowIdToTrigger = req.body.workflowIdToTrigger;
  const webhookUrl = req.body.webhookUrl;

  const webhookPayload = {
    text: 'Hello world!'
  }
  axios.post(webhookUrl, webhookPayload)
    .then(response => console.log(`Webhook responded with a ${response.status} response`))
    .catch(error => console.error('There was an error ', error));

  res.json({
    ok: true,
  });
});

app.post("/api/approval", (req, res) => {
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
