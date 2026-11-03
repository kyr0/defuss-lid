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
- VERIFIED[fastText predict, boost: false] labels with probability < 1e-5 are never returned, even with threshold 0, matching upstream dfs/findKBest; with the boost (default since 2026-11-03) every label gets letter support and can be listed BC `predict('Das ist…',{k:5,boost:false})` returns only de 2026-11-02
- VERIFIED[models/] model files are not in git; models.lock.json pins three Hugging Face releases (kyr0/defuss-lid-1.0 → models/v0.3, kyr0/fastText-pq-dno → models/fastText-pq-dno, kyr0/cld3-pq-dno → models/cld3-pq-dno; read it via scripts/lock.mjs) BC .gitignore `models/` set by maintainer; `fetch-models.mjs --live` matched all 36 files 2026-11-04
- VERIFIED[gate runs] never leave a gate or `make verify` running in the background when a turn ends: the stop hook starts another gate, and the two collide on `coverage/` (Vitest lock) and the e2e port 4317 and `tmp/e2e/` BC 9 chromium e2e failures + coverage lock error that passed when rerun alone 2026-11-02
- VERIFIED[pkgroll 2.29 output] esbuild writes non-ASCII string data as \xNN/\uNNNN escapes and pkgroll has no charset flag; for src/charsets.ts that costs ~1.6x raw bytes but only ~10% gzip BC boost chunk 14.7 kB escaped vs 9.0 kB UTF-8, gzip 4.6 vs 4.2 kB 2026-11-02
- VERIFIED[dnp-tools/cld3/refit.py] per-language reweighting oscillates on languages CLD3 cannot tell apart (hr/bs ~55% each, ms/id, xh/zu, da/no) and fit-split accuracy hides it (memorized cues); guard them as groups with the pack's within-group split as target and read the guard on the selection split BC full-pack rounds swung bs -36 / hr -48, fit bs -1.4 vs selection -17 2026-11-03
- VERIFIED[dnp-tools/cld3 evaluation] held-out splits of the fit sources (FLORES dev→devtest, MASSIVE train→test) hide source overfit; judge an edit also on a source no fit reads (NTREX-128) and give every language every style in fit+selection BC full edit v1 passed the benchmark but lost >1 pt on unseen Tatoeba for 8 of 29 non-MASSIVE languages (ne/mr→hi, uk/bg→ru) 2026-11-03
- VERIFIED[dnp-tools/fastText] fastText pack errors vs lid.176 come mostly from missing rows, not weights: re-encoding rows into 4 PQ groups (`refit.py --requantize 4`, 9 instead of 13 bytes a bucket row) plus one exact swap round (`--swap`) beat the shipped DNO-PQ packs at the same bytes; more swap rounds lowered the fit loss but not test errors BC deferi_6 boosted test errors over 10 slices 3,864 shipped → 3,310 one round, 3,319 six rounds 2026-11-03
- VERIFIED[dnp-tools fit data] FLORES-200 was translated from English Wikinews/Wikijunior/Wikivoyage, so Wikinews fit text must drop articles holding a FLORES sentence (`dnp-tools/fastText/news.py`); the CirrusSearch content index (dumps.wikimedia.org/other/cirrus_search_index) gives plain text without a wikitext parser and can be read cut (bz2 streamed) BC 3 English Wikinews articles held FLORES sentences; Wikinews fit cut deferi_6 NTREX sentence errors 12 → 9 2026-11-03
