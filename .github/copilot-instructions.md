# Repository Agent Rules

Read `AGENT.md` before changing this repository. It is the canonical architecture guide and change ledger.

After every task or code change, inspect Git status, unstaged/staged diffs and recent log; keep `AGENT.md` synchronized when architecture changes. Run relevant checks and review the final diff. Preserve unrelated work. Do not commit, tag or push unless explicitly requested.

`CHANGELOG.md` is the only release-note source. Do not create duplicate release-note documents or mutate changelogs/manifests via local post-commit/post-merge hooks. Keep commit messages clear and descriptive so `scripts/UpdateChangelog.mjs` generates useful Added/Fixed/Changed entries. Existing Husky hooks perform quality checks and `graphify-out/` sync. Use `pnpm publish:release [--version X.Y.Z]` only for an explicitly authorized release request on clean `main`; it bumps manifests, updates `CHANGELOG.md`, commits and tags locally as the git user, and atomically pushes `main` + `vX.Y.Z` so tag-triggered `release.yml` builds and publishes without CI bot commits.
