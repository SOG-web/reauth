# ReAuth V2 Architecture

The V2 architecture represents a significant migration from V1, introducing centralized credentials, enhanced security, and improved introspection capabilities.

## Key Design Principles

### 1. Security-First Code Handling
- **Hash verification codes at rest**: All verification codes are hashed using `hashPassword` before persisting to database
- **Post-password gating**: Verification codes are only sent AFTER successful password validation to prevent user enumeration and spam attacks
- **Enumeration-safe messaging**: Unified ambiguous responses like "Invalid email or password" minimize account enumeration risks
- **Constant-time verification**: All code verification uses `verifyPasswordHash` for security

### 2. Shared Credentials Model
- `credentials` table holds password hashes per subject
- Multiple `identities` rows (provider + identifier) link to the same subject
- Provider metadata (codes, expirations) stored in separate provider-specific tables

### 3. Type-Level Configuration Validation
- Discriminated union configs ensure `sendCode` is required when verification is enabled
- Fail-fast initialization validates configuration at plugin registration time
- TypeScript prevents misconfigurations at compile time

### 4. Enhanced Introspection
- Every step defines `inputs`, `outputs`, and `protocol` metadata
- Engine provides complete introspection of all plugins and steps
- HTTP adapters can auto-generate routes from introspection data

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ReAuthEngine  │────│   EntityService  │────│   SessionService│
│      V2         │    │       V2         │    │        V2       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ├── Phone Plugin V2
         ├── Username Plugin V2
         └── Email Plugin V2 (reference)
```

## Database Schema

### Core Tables
- `subjects`: Central user entity
- `credentials`: Password hashes per subject
- `identities`: Provider-specific identifiers linking to subjects
- `sessions`: Session tokens with expiration

### Provider Tables
- `phone_identities`: Phone-specific metadata (verification/reset codes)
- `username_identities`: Username-specific metadata
- `email_identities`: Email-specific metadata

## Plugin Development

### Creating a V2 Plugin

```typescript
import { createPhonePlugin } from '@re-auth/reauth/v2';

const phonePlugin = createPhonePlugin({
  verifyPhone: true,
  sendCode: async (subject, code, to, type) => {
    // Send SMS code
  },
  codeLength: 6,
  sessionTtlSeconds: 3600,
  testUsers: {
    enabled: true,
    environmentGating: false,
    users: ['+1234567890'],
  },
});
```

### Step Implementation

```typescript
export const loginStep: AuthStepV2<LoginInput, LoginOutput> = {
  name: 'login',
  description: 'Authenticate user with phone and password',
  inputs: loginInputSchema,
  outputs: loginOutputSchema,
  protocol: {
    method: 'POST',
    path: '/phone/login',
    auth: false,
    statusCodes: {
      success: 200,
      error: 401,
      validation: 400,
    },
  },
  async run(input, context) {
    // Step implementation
  },
};
```

## Security Features

### Password Safety
- HaveIBeenPwned integration for registration, reset, and change password flows
- Argon2 password hashing with secure parameters
- Minimum session TTL enforcement (30 seconds)

### Test Users Support
Only email, phone, and username plugins support test users:
- Environment gating for production safety
- Auto-verification for test users
- Configurable user lists

### Code Expiry
- All verification and reset codes have expiry timestamps
- Enforced during validation with constant-time verification
- Hashed at rest for security

## Migration from V1

V2 introduces breaking changes for enhanced security and functionality:

1. **Plugin Registration**: Use `createPhonePlugin()` instead of direct instantiation
2. **Configuration**: Type-safe discriminated unions replace loose configuration
3. **Database Schema**: New shared credentials model requires migration
4. **Step Definitions**: Must include outputs schema and protocol metadata

## Available Plugins

### Phone Plugin
- ✅ Login with phone/password
- ✅ Registration with verification
- ✅ Phone verification via SMS
- ✅ Password reset via SMS
- ✅ Password change (authenticated)
- ✅ Test users support

### Username Plugin
- ✅ Login with username/password
- ✅ Registration (no verification)
- ✅ Password change (authenticated)
- ✅ Test users support
- ❌ No verification flow (by design)

### Email Plugin (Reference)
- ✅ Complete email/password flow
- ✅ Email verification
- ✅ Password reset via email
- ✅ Test users support

## Usage Example

```typescript
import {
  ReAuthEngineV2Impl,
  EntityServiceV2Impl,
  SessionServiceV2Impl,
  createPhonePlugin,
  createUsernamePlugin,
} from '@re-auth/reauth/v2';

// Create services
const entityService = new EntityServiceV2Impl();
const sessionService = new SessionServiceV2Impl();
const engine = new ReAuthEngineV2Impl({ entityService, sessionService });

// Register plugins
engine.registerPlugin(createPhonePlugin({
  verifyPhone: true,
  sendCode: async (subject, code, to, type) => {
    console.log(`SMS to ${to}: Code ${code}`);
  },
}));

engine.registerPlugin(createUsernamePlugin({
  sessionTtlSeconds: 3600,
}));

// Initialize
await engine.initialize();

// Execute steps
const result = await engine.executeStep('phone', 'login', {
  phone: '+1234567890',
  password: 'SecurePass123!',
});
```

## Introspection

```typescript
const introspection = engine.introspect();
console.log('Available plugins:', introspection.plugins.map(p => p.name));
console.log('Database schemas:', introspection.baseSchemas);
```

## Testing

See `examples/v2-demo.ts` for a complete demonstration of V2 features including:
- Plugin registration and initialization
- Step execution
- Introspection
- Security feature demonstrations