# @re-auth/http-adapters

## 1.0.0-alpha.9

### Patch Changes

- Updated dependencies [[`bb5b263`](https://github.com/SOG-web/reauth/commit/bb5b2630ce6330eb2f8b03ecf419cb014f6afcac), [`88233e2`](https://github.com/SOG-web/reauth/commit/88233e210a733eb7e6c278bd223a00ab84c20c91)]:
  - @re-auth/reauth@0.1.0-alpha.12

## 1.0.0-alpha.8

### Patch Changes

- Updated dependencies [[`7d97392`](https://github.com/SOG-web/reauth/commit/7d973928325610bd1ad38cd50e489fa6b0541970)]:
  - @re-auth/reauth@0.1.0-alpha.11

## 1.0.0-alpha.7

### Patch Changes

- Updated dependencies [[`0c254bd`](https://github.com/SOG-web/reauth/commit/0c254bdd3d1ea5c35fa170bf3818e508c7af3a79)]:
  - @re-auth/reauth@0.1.0-alpha.10

## 1.0.0-alpha.6

### Patch Changes

- [`af8a743`](https://github.com/SOG-web/reauth/commit/af8a7437ae7036e3ab24d9407cb468abe19f3d4e) Thanks [@SOG-web](https://github.com/SOG-web)! - patches

- Updated dependencies [[`af8a743`](https://github.com/SOG-web/reauth/commit/af8a7437ae7036e3ab24d9407cb468abe19f3d4e)]:
  - @re-auth/reauth@0.1.0-alpha.9

## 1.0.0-alpha.5

### Patch Changes

- Updated dependencies [[`a34fa29`](https://github.com/SOG-web/reauth/commit/a34fa29a126b5770fe1e5d8338dce836e60a842a)]:
  - @re-auth/reauth@0.1.0-alpha.8

## 1.0.0-alpha.4

### Patch Changes

- Updated dependencies [[`b36d961`](https://github.com/SOG-web/reauth/commit/b36d961f8c9f960f8ef5a8d3647af70525df5def)]:
  - @re-auth/reauth@0.1.0-alpha.7

## 1.0.0-alpha.3

### Minor Changes

- [`52dd086`](https://github.com/SOG-web/reauth/commit/52dd08677f26d31bc16a3db6fffe4f054007968d) Thanks [@SOG-web](https://github.com/SOG-web)! - made more flexible

### Patch Changes

- Updated dependencies [[`52dd086`](https://github.com/SOG-web/reauth/commit/52dd08677f26d31bc16a3db6fffe4f054007968d)]:
  - @re-auth/reauth@0.1.0-alpha.6

## 1.0.0-alpha.2

### Patch Changes

- Updated dependencies [[`f4482ba`](https://github.com/SOG-web/reauth/commit/f4482ba30164c2bb2a7cf7313e91663ad1633453)]:
  - @re-auth/reauth@0.1.0-alpha.5

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
