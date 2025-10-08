import { reAuthRouter } from '@re-auth/http-adapters/adapters/itty-router';
import { engine } from '@/lib/reauth-engine';

// Create itty-router adapter for Next.js
const adapter = reAuthRouter(
  {
    engine,
    basePath: '/api/auth',
  },
  async (request: any) => {
    // Extract device info from Next.js request
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

    return {
      ip,
      userAgent: request.headers.get('user-agent'),
      fingerprint: request.headers.get('x-request-id'),
    };
  },
);

// Create router without CORS (Next.js handles it)
const router = adapter.createRouter('/api/auth', false);

// Export Next.js route handlers
export const GET = router.fetch;
export const POST = router.fetch;
export const PUT = router.fetch;
export const DELETE = router.fetch;
export const PATCH = router.fetch;
export const OPTIONS = router.fetch;
