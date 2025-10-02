# ReAuth Hono Integration Example

This example demonstrates how to integrate the protocol-agnostic ReAuth Core engine with the HTTP protocol using the Hono framework adapter. It showcases the clean separation between the core authentication engine and HTTP protocol implementation.

## 🏗️ Architecture Demonstration

This example illustrates the ReAuth architecture layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    ReAuth Core Engine                       │
│              (Protocol-Agnostic)                           │
│                                                             │
│  • Email/Password Authentication Plugin                     │
│  • Phone/Password Authentication Plugin                     │
│  • Session Management Plugin                               │
│  • SQLite Database Integration                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                HTTP Protocol Adapter                       │
│              (@re-auth/http-adapters)                      │
│                                                             │
│  • Auto-Route Generation                                    │
│  • Cookie-based Session Management                         │
│  • HTTP Context Handling                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Hono Framework Integration                   │
│                                                             │
│  • Hono-specific Middleware                                 │
│  • Route Registration                                       │
│  • HTTP Request/Response Handling                          │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Features Demonstrated

- **Protocol-Agnostic Core**: ReAuth engine configured with plugins independent of HTTP
- **HTTP Protocol Integration**: HTTP adapters translate between HTTP and the core engine
- **Framework Abstraction**: Hono-specific adapter handles framework details
- **Auto-Route Generation**: Authentication routes automatically generated from plugins
- **Database Integration**: SQLite database with Knex.js for entity and session storage
- **Multiple Auth Methods**: Email/password and phone/password authentication
- **Session Management**: HTTP cookie-based session handling
- **Introspection API**: Runtime API discovery for SDK generation

## 🛠️ Setup and Installation

### Prerequisites

- Node.js >= 18
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm migrate

# Start development server
pnpm dev
```

The server will start on `http://localhost:3001`

### Database Setup

The application uses SQLite with database schema versioning. Run migrations to set up the database:

```bash
# Run database migrations
pnpm migrate
```

The migration command will:

1. Load your schema versions from `src/reauth/auth.ts`
2. Detect the current database version
3. Run any pending migrations automatically

For more details on the migration CLI, see the [CLI Migration Documentation](../../packages/reauth/CLI_MIGRATION.md).

## 📡 Available Endpoints

The HTTP adapter automatically generates the following authentication endpoints:

### Email/Password Authentication

- `POST /email-password/register` - Register with email and password
- `POST /email-password/login` - Login with email and password
- `POST /email-password/verify-email` - Verify email address
- `POST /email-password/forgot-password` - Request password reset
- `POST /email-password/reset-password` - Reset password with code

### Phone/Password Authentication

- `POST /phone-password/register` - Register with phone and password
- `POST /phone-password/login` - Login with phone and password
- `POST /phone-password/verify-phone` - Verify phone number

### Session Management

- `POST /session/check` - Check current session status
- `POST /session/logout` - Logout and invalidate session

### Introspection

- `GET /test-introspection` - Get plugin and step information for SDK generation

## 🔧 Configuration

### Core Engine Configuration

The ReAuth engine is configured in `src/reauth/auth.ts`:

```typescript
const reAuth = createReAuthEngine({
  plugins: [
    sessionPlugin({}),
    emailPasswordAuth({
      verifyEmail: true,
      sendCode: async (entity, code, email, type) => {
        // Email sending logic (console.log for demo)
        console.log('sendCode', entity, code, email, type);
      },
    }),
    phonePasswordAuth({
      verifyPhone: true,
      sendCode: async (entity, code, phone) => {
        // SMS sending logic (console.log for demo)
        console.log('sendCode', entity, code, phone);
      },
    }),
  ],
  entity: new KnexEntityService(db, 'entities'),
  session: new KnexSessionService(db, 'sessions'),
});
```

### HTTP Adapter Configuration

The HTTP adapter is configured in `src/index.ts`:

```typescript
const authAdapter = createHonoAdapter(reAuth, {
  cookieName: 'reauth_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});
```

## 🧪 Testing the Integration

### 1. Register a New User

```bash
curl -X POST http://localhost:3001/email-password/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/email-password/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### 3. Check Session

```bash
curl -X POST http://localhost:3001/session/check \
  -H "Content-Type: application/json" \
  -H "Cookie: reauth_session=YOUR_SESSION_TOKEN"
```

### 4. View Introspection Data

```bash
curl http://localhost:3001/test-introspection
```

## 🏛️ Architecture Benefits

This example demonstrates key ReAuth architectural benefits:

1. **Separation of Concerns**: Authentication logic is completely separate from HTTP and framework concerns
2. **Protocol Independence**: The same core engine could work with WebSocket, gRPC, or any other protocol
3. **Framework Flexibility**: Easy to switch from Hono to Express, Fastify, or any other framework
4. **Runtime Compatibility**: Works in Node.js, Deno, Bun, or edge runtimes
5. **Auto-Generation**: HTTP routes are automatically generated from plugin definitions

## 📝 Key Files

- `src/index.ts` - Hono server setup and HTTP adapter integration
- `src/reauth/auth.ts` - Protocol-agnostic ReAuth engine configuration
- `src/reauth/cli.ts` - CLI utilities for database management
- `package.json` - Dependencies and scripts

## 🔗 Related Documentation

- [ReAuth Core Documentation](../../packages/reauth/README.md)
- [HTTP Adapters Documentation](../../packages/http-adapters/README.md)
- [Hono Framework](https://hono.dev/)

Food Product (depends on Market, MarketAgent, ProductAnalyst - all converted)
Order (depends on Food Product, depends on CEC, DeliveryFee)
Payments (related to Order, Wallet)
Coupon (complex with multiple distribution types)
Notifications (complex email logic, can be done last)
