# @re-auth/reauth

## 0.1.0-alpha.6

### Minor Changes

- [`52dd086`](https://github.com/SOG-web/reauth/commit/52dd08677f26d31bc16a3db6fffe4f054007968d) Thanks [@SOG-web](https://github.com/SOG-web)! - made more flexible

## 0.1.0-alpha.5

### Minor Changes

- [`f4482ba`](https://github.com/SOG-web/reauth/commit/f4482ba30164c2bb2a7cf7313e91663ad1633453) Thanks [@SOG-web](https://github.com/SOG-web)! - added root hooks

## 0.1.0-alpha.4

### Patch Changes

- [`abe0bdd`](https://github.com/SOG-web/reauth/commit/abe0bdd0a7aa382160d39f6d9c3618f5fbeccfd8) Thanks [@SOG-web](https://github.com/SOG-web)! - publishing

- [`eaef90f`](https://github.com/SOG-web/reauth/commit/eaef90f7c1513f0912b673c63a42bbda522f5c49) Thanks [@SOG-web](https://github.com/SOG-web)! - fix(http-adapters): fix error response handling in express adapter

  Ensure error responses are properly returned in ExpressAuthAdapter by adding missing return statements. Also corrects version number in package.json and updates Hono adapter documentation.

  The changes include:

  - Adding return statements for all error responses in ExpressAuthAdapter
  - Fixing package version from 0.1.0-alpha.1 to 0.1.0-alpha.0
  - Updating Hono adapter README with correct package name and usage examples

- [`76f8f6b`](https://github.com/SOG-web/reauth/commit/76f8f6b7d32dfc427b56a612cc27cdc8b1f24b80) Thanks [@SOG-web](https://github.com/SOG-web)! - feat(http-adapters): add http adapters package with express, fastify and hono support

  This commit introduces a new @re-auth/http-adapters package that provides HTTP server adapters for various Node.js frameworks including Express, Fastify and Hono. The package includes:

  - Adapter implementations for Express, Fastify and Hono
  - Comprehensive README documentation for each adapter
  - TypeScript type definitions
  - Example usage in documentation
  - Build configuration for both ESM and CJS modules

  The adapters enable seamless integration of ReAuth authentication framework with popular HTTP servers while maintaining type safety and providing consistent API across frameworks.

  BREAKING CHANGE: New package introduced with major version 0.1.0-alpha.1

## 0.1.0-alpha.3

### Patch Changes

- [`4029a37`](https://github.com/SOG-web/reauth/commit/4029a37edc3a1bf224111bc6692ea766b23f2718) Thanks [@SOG-web](https://github.com/SOG-web)! - bump up a little

## 0.1.0-alpha.2

### Patch Changes

- [`27427d4`](https://github.com/SOG-web/reauth/commit/27427d4ef972d2fdc5f6d53eff71aadddced5fd5) Thanks [@SOG-web](https://github.com/SOG-web)! - docs(reauth): enhance README with comprehensive documentation

  - Add detailed installation and setup instructions
  - Document email/password authentication plugin
  - Include guides for creating custom plugins
  - Add API reference and usage examples
  - Improve overall structure and readability

## 0.1.0-alpha.1

### Patch Changes

- [`095dc26`](https://github.com/SOG-web/reauth/commit/095dc262250a05c56ff21756aa0f8bcf8e7c5966) Thanks [@SOG-web](https://github.com/SOG-web)! - feat(reauth): added few plugins, all test are passing
