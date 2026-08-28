# Security Policy

## Supported versions

Only the latest published version receives fixes.

## Reporting a vulnerability

Report privately through
[GitHub Security Advisories](https://github.com/BoxLab-Ltd/yandex-metrica-next/security/advisories/new).
Please do not open a public issue for a vulnerability.

## If this package is compromised

1. Revoke the npm Trusted Publisher for the package.
2. `npm deprecate` every affected version with a pointer to this file.
3. Publish a GitHub Security Advisory.
4. Rotate 2FA and any credentials that touched the release path.
5. Ship a patched release from a clean checkout.
6. Post a public post-mortem in Discussions.
