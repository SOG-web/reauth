# @re-auth/reauth

## 0.1.0-alpha.19

### Patch Changes

- [`765e592`](https://github.com/SOG-web/reauth/commit/765e59221a74f25c20693456b39fe2b7a01538bd) Thanks [@SOG-web](https://github.com/SOG-web)! - fix(email-password.plugin): remove unnecessary auth property from HTTP configuration

  - Removed the 'auth' property from the HTTP configuration in the email-password plugin, streamlining the protocol setup.

## 0.1.0-alpha.18

### Patch Changes

- [`9b14a68`](https://github.com/SOG-web/reauth/commit/9b14a68936c01e41bca106a20a5e72a6e2749dc9) Thanks [@SOG-web](https://github.com/SOG-web)! - create plugin issue fixed

## 0.1.0-alpha.17

### Patch Changes

- [`87e340e`](https://github.com/SOG-web/reauth/commit/87e340e10977b92208a2961c2ef5416c757387ef) Thanks [@SOG-web](https://github.com/SOG-web)! - corrections

## 0.1.0-alpha.16

### Patch Changes

- [`437a0b0`](https://github.com/SOG-web/reauth/commit/437a0b0df9980422612967caafa564a452bef4a1) Thanks [@SOG-web](https://github.com/SOG-web)! - fix auth issue and hono adapter issue

## 0.1.0-alpha.15

### Patch Changes

- [`2bcf805`](https://github.com/SOG-web/reauth/commit/2bcf805e84264d87383efa57695bb78e11e7d953) Thanks [@SOG-web](https://github.com/SOG-web)! - updated session plugin

## 0.1.0-alpha.14

### Patch Changes

- [`bb64ce9`](https://github.com/SOG-web/reauth/commit/bb64ce9a7eeab987d9bfecbf70d4623ae5965cf9) Thanks [@SOG-web](https://github.com/SOG-web)! - remove wsj

## 0.1.0-alpha.13

### Minor Changes

- [`e674fbe`](https://github.com/SOG-web/reauth/commit/e674fbe07643acee880ed56a7b03bac3e2996759) Thanks [@SOG-web](https://github.com/SOG-web)! - almost done

## 0.1.0-alpha.12

### Patch Changes

- [`bb5b263`](https://github.com/SOG-web/reauth/commit/bb5b2630ce6330eb2f8b03ecf419cb014f6afcac) Thanks [@SOG-web](https://github.com/SOG-web)! - p

- [`88233e2`](https://github.com/SOG-web/reauth/commit/88233e210a733eb7e6c278bd223a00ab84c20c91) Thanks [@SOG-web](https://github.com/SOG-web)! - session plugin patch

## 0.1.0-alpha.11

### Patch Changes

- [`7d97392`](https://github.com/SOG-web/reauth/commit/7d973928325610bd1ad38cd50e489fa6b0541970) Thanks [@SOG-web](https://github.com/SOG-web)! - patch build

## 0.1.0-alpha.10

### Patch Changes

- [`0c254bd`](https://github.com/SOG-web/reauth/commit/0c254bdd3d1ea5c35fa170bf3818e508c7af3a79) Thanks [@SOG-web](https://github.com/SOG-web)! - hooks

## 0.1.0-alpha.9

### Patch Changes

- [`af8a743`](https://github.com/SOG-web/reauth/commit/af8a7437ae7036e3ab24d9407cb468abe19f3d4e) Thanks [@SOG-web](https://github.com/SOG-web)! - patches

## 0.1.0-alpha.8

### Patch Changes

- [`a34fa29`](https://github.com/SOG-web/reauth/commit/a34fa29a126b5770fe1e5d8338dce836e60a842a) Thanks [@SOG-web](https://github.com/SOG-web)! - pp

## 0.1.0-alpha.7

### Patch Changes

- [`b36d961`](https://github.com/SOG-web/reauth/commit/b36d961f8c9f960f8ef5a8d3647af70525df5def) Thanks [@SOG-web](https://github.com/SOG-web)! - more cleanup

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
