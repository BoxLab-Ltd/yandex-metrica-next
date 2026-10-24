# Contributing

Issues and pull requests are welcome. For anything larger than a fix, open an issue first — the
pageview behaviour is a contract ([docs/pageviews.md](./docs/pageviews.md)), and a change in the
number or URL of hits is breaking even when no signature moves.

## Setup

[Bun](https://bun.sh) 1.3+ and Node 22.22.2+ (the toolchain's floor; the package itself supports
Node 20.9).

```sh
bun install
bun run typecheck && bun run lint && bun run format:check
bun run build && bun run size && bun run test
bun run lint:pkg && bun run lint:invariants && bun run test:types
```

E2E needs Playwright's Chromium once (`bunx playwright install chromium`):

```sh
bun run e2e list
bun run e2e run next16-turbopack-client
bun run e2e run next16-turbopack-client --next latest   # against another Next
```

[docs/testing.md](./docs/testing.md) explains what each level proves and how the e2e cells are
built.

## Rules that are easy to break

- `src/core` imports nothing from React or Next. `lint:invariants` enforces it.
- Every outbound call goes through the call pipeline, so `beforeSend` sees it.
- Diagnostic text stays behind the literal `process.env.NODE_ENV !== 'production'` guard; a new
  code needs a `## YMxxx` section in [docs/diagnostics.md](./docs/diagnostics.md), and a test
  fails until it has one.
- After writing a check, break what it checks and watch it fail. Over the project's history this
  caught eight checks that were green by accident.
- A change to the files in the tarball updates `test/pack-snapshot.txt`
  (`bun run pack:snapshot <tarball> --update`) in the same commit.
- Everything is in English: code, comments, docs and commit messages.

## Commits

Conventional commits, lowercase imperative subject: `fix(core): keep tag readiness across
remounts`. Scopes in use: `core`, `react`, `pages`, `client`, `testing`, `e2e`, `types`. The body
explains why, not what.

## Releases

Maintainers cut a GitHub Release; `release.yml` verifies the tag against `package.json` and
publishes through npm Trusted Publishing with provenance. There is no CHANGELOG file — release
notes live in GitHub Releases.
