# Agent memory

<!-- One tagged line per durable fact NOT derivable from code, git or docs:
- VERIFIED[scope] fact BC evidence
- HYPOTHESIS[scope] claim BC observation; falsifier=`cmd`
- UNKNOWN[scope] gap BC missing evidence
[scope] = the narrowest path|module|command|condition the evidence covers, not a topic: the entry decides nothing
outside it, and recurrence inside one subsystem never widens it.
Every line carries its BC and stays within 240 chars. Replace stale lines instead of appending.
Mechanizable lessons belong in tests or .vae/VERIFY.py.
Budget 4 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[package.json prepack] `bun pm pack` runs lifecycle scripts without node_modules/.bin on PATH, so call tools via `bun run <script>` BC prepack failed "pkgroll: command not found" 2026-11-02
- VERIFIED[pkgroll dts + typescript 7] rollup-plugin-dts needs the `@typescript/typescript6` compat package BC build error "TypeScript 7 does not ship a compiler API" 2026-11-02
- VERIFIED[tests/*] Node Buffer#slice is a view, not a copy; helpers return `new Uint8Array(...)` BC a tamper test mutated the shared CLD3 core and broke 5 tests 2026-11-02
- VERIFIED[fastText predict] labels with probability < 1e-5 are never returned, even with threshold 0, matching upstream dfs/findKBest BC `predict('Das ist…',{k:5})` returns only de 2026-11-02
- VERIFIED[models/] model files are not in git; models.lock.json pins Hugging Face kyr0/defuss-lid-1.0 BC .gitignore `models/` set by maintainer; `fetch-models.mjs --live` matched all 28 files 2026-11-02
- VERIFIED[gate runs] never leave a gate or `make verify` running in the background when a turn ends: the stop hook starts another gate, and the two collide on `coverage/` (Vitest lock) and the e2e port 4317 and `tmp/e2e/` BC 9 chromium e2e failures + coverage lock error that passed when rerun alone 2026-11-02
