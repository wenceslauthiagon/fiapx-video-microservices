const jwt = require('jsonwebtoken');

function createAccessToken(payload, secret, expiresIn = '7d') {
  return jwt.sign(payload, secret, { expiresIn });
}

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }
  return headerValue.startsWith('Bearer ') ? headerValue.replace('Bearer ', '') : null;
}

function validateRegisterPayload(body) {
  return Boolean(body?.email && body?.password && body?.name);
}

module.exports = {
  createAccessToken,
  extractBearerToken,
  validateRegisterPayload,
};
