---
'@re-auth/http-adapters': minor
'@re-auth/reauth': patch
---

feat(http-adapters): add http adapters package with express, fastify and hono support

This commit introduces a new @re-auth/http-adapters package that provides HTTP server adapters for various Node.js frameworks including Express, Fastify and Hono. The package includes:

- Adapter implementations for Express, Fastify and Hono
- Comprehensive README documentation for each adapter
- TypeScript type definitions
- Example usage in documentation
- Build configuration for both ESM and CJS modules

The adapters enable seamless integration of ReAuth authentication framework with popular HTTP servers while maintaining type safety and providing consistent API across frameworks.

BREAKING CHANGE: New package introduced with major version 0.1.0-alpha.1
