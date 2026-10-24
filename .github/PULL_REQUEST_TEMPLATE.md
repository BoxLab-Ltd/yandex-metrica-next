## What and why

<!-- What changes, and the problem it solves. Link the issue if there is one. -->

## Pageviews

- [ ] This does not change the number or URL of hits for unchanged user code
- [ ] It does — the change is described above, and [docs/pageviews.md](../blob/main/docs/pageviews.md) is updated

## Checklist

- [ ] `bun run typecheck && bun run lint && bun run format:check`
- [ ] `bun run build && bun run size && bun run test`
- [ ] `bun run lint:pkg && bun run lint:invariants && bun run test:types`
- [ ] A new check was broken once on purpose and seen to fail
- [ ] Docs updated, and `test/pack-snapshot.txt` if the tarball's file list changed
