const express = require("express");
 
// Create express app as usual
const app = express();


app.get("/api", (req, res) => {
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
