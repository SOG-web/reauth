# Two-Factor Authentication (2FA) Plugin V2

A comprehensive Two-Factor Authentication plugin for ReAuth V2 that provides multi-method 2FA support including TOTP, SMS, email codes, and backup codes.

## Features

✅ **TOTP Support** - Time-based One-Time Passwords (RFC 6238) compatible with Google Authenticator, Authy, etc.  
✅ **SMS 2FA** - SMS-based verification codes with rate limiting  
✅ **Email 2FA** - Email-based verification codes  
✅ **Backup Codes** - Recovery codes for account access when primary methods fail  
✅ **Security Controls** - Failed attempt tracking, lockouts, and rate limiting  
✅ **Cross-Platform** - Works across Node.js, Deno, Bun, browsers, and edge runtimes  
✅ **Protocol Agnostic** - No HTTP dependencies, works with any transport layer  
✅ **Background Cleanup** - Automatic cleanup of expired codes and old records  

## Installation

The 2FA plugin is included in the core ReAuth V2 package:

```typescript
import { 
  twoFactorAuthPluginV2, 
  twoFactorAuthSchema,
  type TwoFactorAuthConfigV2 
} from '@re-auth/reauth/v2';
```

## Basic Setup

```typescript
import { ReAuthEngineV2, twoFactorAuthPluginV2, twoFactorAuthSchema } from '@re-auth/reauth/v2';

// Configure the plugin
const twoFactorConfig: TwoFactorAuthConfigV2 = {
  // TOTP is enabled by default
  totp: {
    enabled: true,
    issuer: 'MyApp',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    window: 1, // Allow 1 time step tolerance
  },

  // Configure SMS 2FA (requires implementation)
  sms: {
    enabled: true,
    sendCode: async (phone, code, userId) => {
      // Implement SMS sending logic
      await sendSMS(phone, `Your verification code: ${code}`);
    },
    codeLength: 6,
    expiryMinutes: 10,
    rateLimit: {
      maxAttempts: 3,
      windowMinutes: 60,
    },
  },

  // Configure Email 2FA (requires implementation)
  email: {
    enabled: true,
    sendCode: async (email, code, userId) => {
      // Implement email sending logic
      await sendEmail(email, 'Verification Code', `Your code: ${code}`);
    },
    codeLength: 6,
    expiryMinutes: 10,
  },

  // Backup codes for recovery
  backupCodes: {
    enabled: true,
    count: 10,
    length: 8,
  },

  // Security settings
  security: {
    requireForLogin: false, // Set to true to make 2FA mandatory
    requireForSensitiveActions: true,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 30,
  },
};

// Create the engine with 2FA plugin
const engine = new ReAuthEngineV2({
  dbClient: myFumaClient,
  plugins: [
    twoFactorAuthPluginV2.configure(twoFactorConfig)
  ],
});
```

## Database Schema

Add the 2FA tables to your database schema:

```typescript
import { twoFactorAuthSchema } from '@re-auth/reauth/v2';

const schema = buildSchemaV2({
  // Your existing schemas...
  ...twoFactorAuthSchema.tables,
});
```

This creates the following tables:
- `two_factor_methods` - Store user's 2FA methods (TOTP secrets, phone/email)
- `two_factor_codes` - Temporary verification codes for SMS/email
- `two_factor_backup_codes` - Recovery backup codes
- `two_factor_hardware_tokens` - WebAuthn/FIDO2 security keys (future)
- `two_factor_failed_attempts` - Failed authentication attempts for security

## Usage Examples

### Setting up TOTP

```typescript
// Setup TOTP for a user
const result = await engine.executeStep('setup-2fa', {
  userId: 'user123',
  methodType: 'totp',
  issuer: 'MyApp',
  accountName: 'user@example.com',
});

if (result.success) {
  // Show QR code to user for scanning
  console.log('QR Code URL:', result.qrCodeUrl);
  console.log('Secret (manual entry):', result.secret);
}
```

### Setting up SMS 2FA

```typescript
// Setup SMS 2FA for a user
const result = await engine.executeStep('setup-2fa', {
  userId: 'user123',
  methodType: 'sms', 
  phone: '+1234567890',
});

// Then send verification code
const codeResult = await engine.executeStep('send-2fa-code', {
  userId: 'user123',
  methodType: 'sms',
});
```

### Verifying 2FA Codes

```typescript
// Verify TOTP code
const verification = await engine.executeStep('verify-2fa', {
  userId: 'user123',
  code: '123456',
  methodType: 'totp',
});

if (verification.verified) {
  console.log('2FA verification successful!');
}

// Verify SMS/Email code
const smsVerification = await engine.executeStep('verify-2fa', {
  userId: 'user123', 
  code: '789012',
  methodType: 'sms',
});

// Verify backup code
const backupVerification = await engine.executeStep('verify-2fa', {
  userId: 'user123',
  code: 'ABCD1234',
  methodType: 'backup',
});

console.log('Remaining backup codes:', backupVerification.remainingBackupCodes);
```

### Managing 2FA Methods

```typescript
// List user's 2FA methods
const methods = await engine.executeStep('list-methods', {
  userId: 'user123',
});

console.log('User has', methods.methods.length, '2FA methods enabled');
methods.methods.forEach(method => {
  console.log(`- ${method.methodType}: ${method.maskedIdentifier} (verified: ${method.isVerified})`);
});

// Generate backup codes
const backupCodes = await engine.executeStep('generate-backup-codes', {
  userId: 'user123',
});

console.log('Generated backup codes:', backupCodes.backupCodes);

// Disable a specific 2FA method
await engine.executeStep('disable-2fa', {
  userId: 'user123',
  methodId: 'method-id-here',
});

// Disable all 2FA methods (requires confirmation in production)
await engine.executeStep('disable-2fa', {
  userId: 'user123',
  confirmationCode: 'sent-via-email', // Optional verification
});
```

## Integration with Authentication Flow

```typescript
// In your login step, check if 2FA is required
async function loginWithPassword(email: string, password: string) {
  // 1. Verify password first
  const passwordValid = await verifyPassword(email, password);
  if (!passwordValid) {
    return { success: false, message: 'Invalid credentials' };
  }

  // 2. Check if user has 2FA enabled
  const user = await getUserByEmail(email);
  const twoFactorMethods = await engine.executeStep('list-methods', {
    userId: user.id,
  });

  if (twoFactorMethods.methods.length > 0) {
    // User has 2FA - require verification
    return {
      success: false,
      requiresTwoFactor: true,
      userId: user.id,
      message: 'Two-factor authentication required',
    };
  }

  // No 2FA required - login successful
  return await createSession(user);
}

// Separate step to complete 2FA verification
async function completeTwoFactorLogin(userId: string, code: string, methodType: string) {
  const verification = await engine.executeStep('verify-2fa', {
    userId,
    code,
    methodType,
  });

  if (verification.verified) {
    const user = await getUserById(userId);
    return await createSession(user);
  }

  return { success: false, message: 'Invalid 2FA code' };
}
```

## Security Features

### Rate Limiting
- SMS/Email codes are rate limited (3 attempts per hour by default)
- Failed verification attempts are tracked and can trigger lockouts
- Configurable lockout durations and attempt limits

### Code Security
- All verification codes are hashed before storage
- Codes have configurable expiry times
- TOTP uses secure time window validation with replay protection
- Backup codes are single-use and securely generated

### Cleanup and Maintenance
- Automatic cleanup of expired codes and old records
- Configurable retention periods for audit data
- Background cleanup runs on a scheduled interval

## Protocol Agnostic Design

The plugin works with any transport layer:

```typescript
// HTTP adapter
app.post('/auth/setup-2fa', async (req, res) => {
  const result = await engine.executeStep('setup-2fa', req.body);
  res.json(result);
});

// WebSocket adapter
ws.on('message', async (data) => {
  const { action, payload } = JSON.parse(data);
  if (action === 'verify-2fa') {
    const result = await engine.executeStep('verify-2fa', payload);
    ws.send(JSON.stringify(result));
  }
});

// GraphQL resolver
const resolvers = {
  Mutation: {
    setup2fa: async (parent, args, context) => {
      return await engine.executeStep('setup-2fa', args);
    },
  },
};
```

## Runtime Compatibility

The plugin uses cross-platform crypto utilities that work across:

- **Node.js** - Uses native crypto module with Web Crypto API when available
- **Deno** - Uses Web Crypto API
- **Bun** - Uses Web Crypto API  
- **Browsers** - Uses Web Crypto API
- **Edge Runtimes** - Uses Web Crypto API (Cloudflare Workers, Vercel Edge, etc.)

## Configuration Reference

See the `TwoFactorAuthConfigV2` interface in `types.ts` for complete configuration options.

## Testing

The plugin includes comprehensive tests covering:
- TOTP generation and verification
- Cross-platform crypto compatibility
- Plugin configuration validation
- Step input/output validation
- Security and rate limiting features

Run tests with:
```bash
pnpm test src/v2/plugins/two-factor-auth/
```

## License

This plugin is part of the ReAuth project and follows the same license terms.