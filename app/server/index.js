// Vercel Express entrypoint fallback
const app = require('./dist/index.js');
module.exports = app;
module.exports.default = app;
