const queryString = require('query-string');

function azureBodyParser() {
    return function(req, res, next) {
        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        req.body = queryString.parse(req.body, { arrayFormat: 'bracket' });
      }
  
      next();
    };
  }
  
  module.exports = azureBodyParser;
