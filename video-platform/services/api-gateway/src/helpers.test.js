const { faker } = require('@faker-js/faker');
const { createAccessToken, extractBearerToken, validateRegisterPayload } = require('./helpers');

describe('createAccessToken', () => {
  const secret = faker.string.alphanumeric(32);
  const payload = { userId: faker.string.uuid(), email: faker.internet.email() };

  it('TC0001 - Should return a signed JWT string', () => {
    const token = createAccessToken(payload, secret, '1h');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('TC0002 - Should embed payload into the token', () => {
    const jwt = require('jsonwebtoken');
    const token = createAccessToken(payload, secret, '1h');
    const decoded = jwt.verify(token, secret);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });
});

describe('extractBearerToken', () => {
  it('TC0001 - Should extract token from valid Bearer header', () => {
    const token = faker.string.alphanumeric(64);
    expect(extractBearerToken(`Bearer ${token}`)).toBe(token);
  });

  it('TC0002 - Should return null when header is missing', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('TC0003 - Should return null when header has no Bearer prefix', () => {
    expect(extractBearerToken(faker.string.alphanumeric(32))).toBeNull();
  });

  it('TC0004 - Should return null when header is not a string', () => {
    expect(extractBearerToken(12345)).toBeNull();
  });
});

describe('validateRegisterPayload', () => {
  it('TC0001 - Should return true for a complete payload', () => {
    const body = { email: faker.internet.email(), password: faker.internet.password(), name: faker.person.fullName() };
    expect(validateRegisterPayload(body)).toBe(true);
  });

  it('TC0002 - Should return false when email is missing', () => {
    expect(validateRegisterPayload({ password: 'pass', name: 'Name' })).toBe(false);
  });

  it('TC0003 - Should return false when password is missing', () => {
    expect(validateRegisterPayload({ email: 'a@b.com', name: 'Name' })).toBe(false);
  });

  it('TC0004 - Should return false when body is null', () => {
    expect(validateRegisterPayload(null)).toBe(false);
  });
});

