function buildNotificationRecord(id, jobId, type, message, createdAt) {
  return {
    id,
    jobId,
    type,
    message,
    sent: true,
    createdAt,
  };
}

module.exports = {
  buildNotificationRecord,
};
