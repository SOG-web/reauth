// Express.js Integration Example
import express from 'express';
import { ReAuthEngineV2 } from '@re-auth/reauth';
import { createExpressAdapter } from '@re-auth/http-adapters-v2';

const app = express();
app.use(express.json());

// Initialize ReAuth V2 Engine with your configuration
const engine = new ReAuthEngineV2({
  dbClient: yourDatabaseClient, // Configure with your database
  plugins: [
    // Add your V2 authentication plugins here
  ],
});

// Create Express adapter with comprehensive configuration
const adapter = createExpressAdapter({
  engine,
  basePath: '/api/auth',
  cors: {
    origin: ['https://your-frontend.com', 'http://localhost:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
  },
  security: {
    helmet: true, // Enable security headers
  },
  validation: {
    validateInput: true,
    maxPayloadSize: 1024 * 1024, // 1MB
    sanitizeFields: ['email', 'username'],
  },
});

// Use the adapter middleware
app.use('/api/auth', adapter.createMiddleware());

// Create and mount the authentication routes
const authRouter = adapter.createRouter();
app.use('/api/auth', authRouter);

// OPTION 1: Use user middleware globally to populate req.user on all requests
app.use(adapter.createUserMiddleware());

// OPTION 2: Use user middleware on specific routes only
// app.use('/api/protected', adapter.createUserMiddleware());

// Example protected route using req.user (populated by middleware)
app.get('/api/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  res.json({
    message: 'Profile data',
    user: req.user.subject,
    sessionValid: req.user.valid,
  });
});

// Example route manually checking for current user
app.get('/api/dashboard', async (req, res) => {
  const user = await adapter.getCurrentUser(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  res.json({
    message: 'Dashboard data',
    user: user.subject,
    lastAccessed: user.metadata?.lastAccessed,
  });
});

// Example route with optional authentication
app.get('/api/content', async (req, res) => {
  const user = await adapter.getCurrentUser(req);
  
  res.json({
    message: 'Content data',
    isAuthenticated: !!user,
    user: user?.subject || null,
    // Show different content based on authentication status
    content: user ? 'Premium content' : 'Public content',
  });
});

// Optional: Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Authentication endpoints available at http://localhost:${PORT}/api/auth`);
  console.log('Available endpoints:');
  
  adapter.getEndpoints().forEach(endpoint => {
    console.log(`  ${endpoint.method} ${endpoint.path}`);
  });
});

export default app;