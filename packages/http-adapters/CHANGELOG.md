# @re-auth/http-adapters

## 0.1.0-alpha.1

### Minor Changes

- [`76f8f6b`](https://github.com/SOG-web/reauth/commit/76f8f6b7d32dfc427b56a612cc27cdc8b1f24b80) Thanks [@SOG-web](https://github.com/SOG-web)! - feat(http-adapters): add http adapters package with express, fastify and hono support

  This commit introduces a new @re-auth/http-adapters package that provides HTTP server adapters for various Node.js frameworks including Express, Fastify and Hono. The package includes:

  - Adapter implementations for Express, Fastify and Hono
  - Comprehensive README documentation for each adapter
  - TypeScript type definitions
  - Example usage in documentation
  - Build configuration for both ESM and CJS modules

  The adapters enable seamless integration of ReAuth authentication framework with popular HTTP servers while maintaining type safety and providing consistent API across frameworks.

  BREAKING CHANGE: New package introduced with major version 0.1.0-alpha.1

### Patch Changes

- [`eaef90f`](https://github.com/SOG-web/reauth/commit/eaef90f7c1513f0912b673c63a42bbda522f5c49) Thanks [@SOG-web](https://github.com/SOG-web)! - fix(http-adapters): fix error response handling in express adapter

  Ensure error responses are properly returned in ExpressAuthAdapter by adding missing return statements. Also corrects version number in package.json and updates Hono adapter documentation.

  The changes include:

  - Adding return statements for all error responses in ExpressAuthAdapter
  - Fixing package version from 0.1.0-alpha.1 to 0.1.0-alpha.0
  - Updating Hono adapter README with correct package name and usage examples

- Updated dependencies [[`abe0bdd`](https://github.com/SOG-web/reauth/commit/abe0bdd0a7aa382160d39f6d9c3618f5fbeccfd8), [`eaef90f`](https://github.com/SOG-web/reauth/commit/eaef90f7c1513f0912b673c63a42bbda522f5c49), [`76f8f6b`](https://github.com/SOG-web/reauth/commit/76f8f6b7d32dfc427b56a612cc27cdc8b1f24b80)]:
  - @re-auth/reauth@0.1.0-alpha.4
