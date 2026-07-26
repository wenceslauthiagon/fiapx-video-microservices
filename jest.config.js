module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: String.raw`.*\.spec\.ts$`,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/application/use-cases/**/*.ts',
    'src/domain/entities/**/*.ts',
    'src/auth/**/*.ts',
    'src/video/**/*.ts',
    'src/shared/dtos/**/*.ts',
    'src/shared/guards/**/*.ts',
    'src/shared/app.constants.ts',
    'src/infrastructure/repositories/**/*.ts',
    '!**/*.module.ts',
    '!**/index.ts',
    '!**/*.d.ts',
    '!src/video/video-processor.service.ts',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
};
