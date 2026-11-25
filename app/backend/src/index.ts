import app, { createApp } from './app';

export { createApp };
export default app;

// Compatibility for Vercel Express preset & CommonJS loaders
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
  module.exports.default = app;
  module.exports.createApp = createApp;
}
