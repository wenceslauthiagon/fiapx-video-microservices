const path = require('node:path');

function buildOutputPath(outputBaseDir, jobId) {
  return path.join(outputBaseDir, `${jobId}.zip`);
}

function buildNotificationEvent(jobId, type, message) {
  return {
    jobId,
    type,
    message,
  };
}

module.exports = {
  buildOutputPath,
  buildNotificationEvent,
};
