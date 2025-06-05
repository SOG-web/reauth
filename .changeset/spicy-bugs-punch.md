---
'@re-auth/http-adapters': patch
'@re-auth/reauth': patch
---

fix(http-adapters): fix error response handling in express adapter

Ensure error responses are properly returned in ExpressAuthAdapter by adding missing return statements. Also corrects version number in package.json and updates Hono adapter documentation.

The changes include:

- Adding return statements for all error responses in ExpressAuthAdapter
- Fixing package version from 0.1.0-alpha.1 to 0.1.0-alpha.0
- Updating Hono adapter README with correct package name and usage examples
