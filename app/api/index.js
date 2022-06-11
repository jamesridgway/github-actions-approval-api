const createHandler = require("azure-function-express").createHandler;
const app = require('./app');

module.exports = createHandler(app);
