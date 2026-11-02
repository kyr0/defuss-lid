# CLI gist

<!-- Commands future agents need that the Makefile verbs do not cover (setup, env, data, deploy):
- VERIFIED[purpose] `cmd`: only after an observed success
- UNKNOWN[purpose] BC gap
Budget 2 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[fast e2e] `E2E_SKIP_BROWSERS=1 bun run e2e`: tarball, consumers, types, wheel, all documented examples on Node/Bun/Python, no browsers
- VERIFIED[live models] `node scripts/fetch-models.mjs --live` and `E2E_LIVE=1 bunx playwright test e2e/site.spec.mjs`: check the real Hugging Face release
- VERIFIED[after runtime edits] `bun run build && bun run docs && node scripts/sizes.mjs --write`: refresh docs/assets/lib and every generated block (README sizes/packs, site budget cards and accuracy rows); verify.mjs fails otherwise
- VERIFIED[site dev loop] `bunx playwright test e2e/site.spec.mjs` serves the repo root on port 4317 (E2E_PORT overrides)
