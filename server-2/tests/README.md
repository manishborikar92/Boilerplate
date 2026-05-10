# CA-Flow Server Tests

This directory contains comprehensive tests for the CA-Flow server application.

## Test Structure

```
tests/
├── setup.js                    # Test environment setup
├── unit/                       # Unit tests
│   ├── User.test.js           # User model tests
│   ├── jwt.test.js            # JWT utility tests
│   └── auth.middleware.test.js # Auth middleware tests
└── integration/                # Integration tests
    └── auth.test.js           # Auth API endpoint tests
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run only unit tests
```bash
npm run test:unit
```

### Run only integration tests
```bash
npm run test:integration
```

### Run tests with coverage
```bash
npm test
```

Coverage reports will be generated in the `coverage/` directory.

## Test Coverage

The test suite covers:

### Unit Tests
- **User Model**: Creation, validation, password hashing, token generation
- **JWT Utilities**: Token generation and verification for access and refresh tokens
- **Auth Middleware**: Route protection and role-based authorization

### Integration Tests
- **Registration**: User registration flow with validation
- **Login**: Email/password authentication
- **Token Refresh**: Access token refresh using refresh tokens
- **Protected Routes**: Accessing protected endpoints with authentication
- **Password Management**: Password change functionality

## Writing New Tests

### Unit Test Example
```javascript
describe('Feature Name', () => {
  it('should do something', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = await someFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Integration Test Example
```javascript
describe('POST /api/endpoint', () => {
  it('should return success', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'test' })
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
});
```

## Test Database

Tests use MongoDB Memory Server for isolated testing without affecting the development database.

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Database is cleared between tests automatically
3. **Descriptive Names**: Use clear, descriptive test names
4. **AAA Pattern**: Arrange, Act, Assert
5. **Mock External Services**: Mock email services, Firebase, etc.

## Future Test Additions

- E2E tests with Playwright/Cypress
- Load testing with Artillery
- Security testing with OWASP ZAP
- API contract testing
