# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/browser_check.mjs learn=none: replaced by a shim to scripts/e2e.mjs; parity lives in e2e/parity.spec.mjs
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/reproduce_v02.py learn=none: repointed; stage not executed here (needs downloaded corpora)
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/package_release.py:excluded learn=none: exclusions added; not executed because it rewrites SHA256SUMS
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/verify_native.py learn=none: import moved after argument parsing; not run with fastText installed
2026-11-02T09:38:51Z s=d9c6d40f FINDING README.md:156 packs paragraph learn=none: prose comparison, not mechanically checkable; the figures it summarizes are generated and verified
2026-11-02T09:44:49Z s=d9c6d40f FAIL tests.e2e.1
2026-11-02T09:46:43Z s=d9c6d40f DONE fp=bc52fc809e07 cov=96.3% paths=.claude/settings.json,.github/workflows/verify.yml,.oxlintrc.json,AGENTS.md(+101)
2026-11-02T09:46:43Z s=d9c6d40f FINDING scripts/sizes.mjs:reportRows learn=test: e2e/site.spec.mjs accuracy test matches each generated row, including the 2-decimal pack kB only that table has, against results-v0.3.md
2026-11-02T09:46:43Z s=d9c6d40f FINDING e2e/site.spec.mjs:packs budget table learn=test: passes in chromium, firefox and webkit
2026-11-02T09:46:43Z s=d9c6d40f FINDING gate run (operational) learn=memory: .vae/MEMORY.md line 'gate runs'
2026-11-02T09:53:55Z s=d9c6d40f DONE fp=5a594d446bc7 cov=96.3% paths=.claude/settings.json,.github/workflows/verify.yml,.oxlintrc.json,AGENTS.md(+100)
2026-11-02T09:53:55Z s=d9c6d40f FINDING .gitignore:dist/ learn=verifier: scripts/verify.mjs site-runtime-copy now runs git check-ignore over the site files; a probe re-adding `dist/` failed with 8 findings
2026-11-02T09:53:55Z s=d9c6d40f FINDING SHA256SUMS, scripts/package_release.py, scripts/browser_check.mjs learn=none: one-time cleanup requested by the maintainer
2026-11-02T09:53:55Z s=d9c6d40f FINDING scripts/coverage.mjs + docs/index.html coverage block learn=verifier: `make coverage` runs scripts/coverage.mjs --check after measuring
2026-11-02T12:05:08Z s=d9c6d40f FAIL tests.e2e.1
2026-11-02T12:07:52Z s=d9c6d40f DONE fp=6274259d5d78 cov=96.3% paths=.github/workflows/verify.yml,README.md,bun.lock,docs/index.html(+4)
2026-11-02T12:07:52Z s=d9c6d40f FINDING scripts/sizes.mjs:measure learn=verifier: scripts/verify.mjs check=versions fails when the verify job's node-version|bun-version|uv version differs from mise.toml; probe with node-version '26' failed as
2026-11-02T12:07:52Z s=d9c6d40f FINDING tests/serve.test.ts:9 learn=test: the runtimes job runs this Vitest test on windows-latest, which fails on recurrence
2026-11-02T12:07:52Z s=d9c6d40f FINDING README.md:174 P (precision) learn=none: one-off wording; the figures themselves are gate-checked
2026-11-02T12:22:36Z s=d9c6d40f DONE fp=153a33e44ac4 cov=96.3% paths=defuss_lid/cld3_pack.py,defuss_lid/evaluate.py,scripts/build_candidates.py,scripts/build_cld3.py(+17)
2026-11-02T12:22:36Z s=d9c6d40f FINDING tests/test_runtime.py:29 (+46 sibling calls in defuss_lid/, scripts/, tests/) learn=test: tests/test_text_encoding.py scans every Python file of defuss_lid/, scripts/ and tests/ and fails on a text-mode call without encoding; it failed before the fix
2026-11-02T20:32:07Z s=b132b503 FAIL prose
2026-11-02T20:38:41Z s=b132b503 DONE fp=c106ca1b520e cov=96.9% paths=ARCH.md,README.md,docs/index.html,e2e/site.spec.mjs(+8)
2026-11-02T20:38:41Z s=b132b503 FINDING src/boost.ts:share learn=test: tests/boost.test.ts 'a language written in Latin or another script counts the better-fitting one, not both' (Компания Apple: ru 8/13, sr 7/13)
2026-11-02T20:38:41Z s=b132b503 FINDING src/boost.ts:checkTop1 learn=test: tests/boost.test.ts 'tied candidates replace the answer only when it explains none of the letters' (Arabic text vs ja; eBayやCraigsl stays ja)
2026-11-02T20:38:41Z s=b132b503 FINDING scripts/sizes.mjs:runtimes learn=none: closure() derives the file list from the imports, so there is no chunk-name list left to drift; scripts/verify.mjs 'generated' recomputes the blocks with it
2026-11-02T20:38:41Z s=b132b503 FINDING src/charsets.ts:qu,lb,li,ig,mg,cy,da,sv,fi,sa,mai,bh,ja,zh learn=none: the check needs the FLORES-200 corpora, which are downloaded outside git, so it cannot run in the gate
2026-11-02T20:38:41Z s=b132b503 FINDING src/boost.ts:module doc learn=none: documentation wording
2026-11-02T20:38:41Z s=b132b503 FINDING src/boost.ts:checkTop1 doc + ARCH.md:13 learn=none: one-off measurements recorded with their date
2026-11-02T20:38:41Z s=b132b503 FINDING src/cld3-pack.ts:Cld3Prediction.reliable learn=none: documentation wording
2026-11-02T20:38:41Z s=b132b503 FINDING README.md:23,142-145 learn=verifier: vae.py prose check in the gate
2026-11-02T20:48:03Z s=b132b503 DONE fp=688c268538f7 cov=96.9% paths=ARCH.md,README.md,defuss_lid/__init__.py,docs/assets/site.css(+14)
2026-11-02T23:30:58Z s=b132b503 FAIL tests.e2e.1
2026-11-02T23:46:56Z s=b132b503 DONE fp=71893694e987 cov=96.9% paths=ARCH.md,README.md,defuss_lid/__init__.py,dnp-tools/cld3/README.md(+18)
2026-11-02T23:46:56Z s=b132b503 FINDING e2e/site.spec.mjs:71 learn=none: intended copy change by the maintainer; the e2e assertion is the check and caught it
2026-11-02T23:46:56Z s=b132b503 FINDING docs/index.html:9 og:title learn=none: one-off copy sync decided by the maintainer
2026-11-02T23:46:56Z s=b132b503 FINDING docs/index.html:120 hero description learn=none: a product claim the maintainer owns; no mechanical check can decide it
2026-11-02T23:46:56Z s=b132b503 FINDING dnp-tools/cld3/dnp.py:check learn=test: tests/test_dnp_cld3.py::test_replica_matches_cld3_asm runs check(), which now fails on missing rows
2026-11-02T23:46:56Z s=b132b503 FINDING dnp-tools/cld3/dnp.py:cmd_check learn=none: needs FLORES data that is not in git; the filter is the shared supported() used by every FLORES path
2026-11-03T00:05:38Z s=b132b503 FAIL coverage
2026-11-03T00:08:16Z s=b132b503 DONE fp=a34de9919ec4 cov=96.9% paths=ARCH.md,README.md,defuss_lid/__init__.py,dnp-tools/cld3/README.md(+20)
2026-11-03T00:08:16Z s=b132b503 FINDING scripts/sentence_starts.mjs:classify learn=test: tests/sentence-starts.test.ts asserts the cause order including unseen and words
2026-11-03T00:08:16Z s=b132b503 FINDING scripts/sentence_starts.mjs:evaluate reliable errors learn=none: report presentation of a field fastText does not have; regenerated REPORT.md shows '-'
2026-11-03T00:08:16Z s=b132b503 FINDING docs/index.html coverage block learn=verifier: already enforced by scripts/coverage.mjs --check in make coverage
2026-11-03T04:58:50Z s=b132b503 DONE fp=268612e7b9f9 cov=96.9% paths=ARCH.md,README.md,defuss_lid/__init__.py,dnp-tools/cld3/README.md(+25)
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/corpora.py:tatoeba_rows learn=test: tests/test_dnp_cld3.py::test_tatoeba_rows_keep_only_the_asked_script
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/romanize.mjs:BG learn=test: tests/test_dnp_cld3.py::test_romanized_text_is_latin_or_raises covers both the mapping and the fail-closed check
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/refit.py:inputs learn=test: tests/test_dnp_cld3.py::test_inputs_cache_is_keyed_by_the_texts fails on the old key
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/corpora.py:build_texts (data design) learn=memory: .vae/MEMORY.md line [dnp-tools/cld3 evaluation]; a data-coverage judgement no rule kind can check mechanically
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/refit.py (data section) learn=none: structure change; covered by the existing refit tests and the rebuilt corpora run
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/corpora.py:download learn=none: no observed truncation; robustness fix without a reproducible failure
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/eval.mjs:testFile learn=none: observability of an operator mistake; not worth a test
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/README.md:Results full learn=none: reported result, not a code defect
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/README.md:L49 P09/B09 learn=none: prose fix; vae.py prose passes
2026-11-03T04:58:50Z s=b132b503 FINDING dnp-tools/cld3/romanize.mjs:header learn=none: documentation claim corrected against eval-full-v2.json
2026-11-03T06:20:04Z s=b132b503 DONE fp=c5042b9a2e57 cov=96.9% paths=ARCH.md,README.md,defuss_lid/__init__.py,dnp-tools/cld3/METHOD.md(+27)
2026-11-03T06:20:04Z s=b132b503 FINDING dnp-tools/cld3/prune.py:_features learn=none: performance, fixed before first use; tests/test_dnp_cld3.py::test_feature_matrices_match_the_replica_inputs checks the output
2026-11-03T06:20:04Z s=b132b503 FINDING dnp-tools/cld3/prune.py:write_pruned learn=test: tests/test_dnp_cld3.py::test_pruned_pack_reads_dropped_rows_as_zeros runs the real WASM on a pack with every third row zeroed
2026-11-03T06:20:04Z s=b132b503 FINDING dnp-tools/cld3/METHOD.md:L2-errors B01 learn=none: prose fix against the cause definition
2026-11-03T06:20:04Z s=b132b503 FINDING dnp-tools/cld3/METHOD.md:penalty rationale L01/B03 learn=none: comparison now within one setting
2026-11-03T06:20:04Z s=b132b503 FINDING dnp-tools/cld3/METHOD.md:What the edit changed B02 learn=none: reported measurement
2026-11-03T06:20:04Z s=b132b503 FINDING dnp-tools/cld3/README.md:pruning round list P01 learn=none: prose precision fix
2026-11-03T06:37:11Z s=b132b503 FAIL tests.unit,coverage
2026-11-03T06:40:35Z s=b132b503 DONE fp=4b70b0d2509c cov=96.9% paths=ARCH.md,README.md,defuss_lid/__init__.py,dnp-tools/cld3/METHOD.md(+31)
2026-11-03T06:40:35Z s=b132b503 FINDING src/boost.ts:boostWeight learn=test: tests/boost.test.ts asserts predict() == predict({boost: true}) and boost 0 == false for fastText and CLD3
2026-11-03T06:40:35Z s=b132b503 FINDING tests/fasttext.test.ts,tests/cld3.test.ts,tests/boost.test.ts learn=none: test intent made explicit
2026-11-03T06:40:35Z s=b132b503 FINDING dnp-tools/cld3/wasm_dump.mjs,dnp-tools/cld3/eval.mjs,scripts/sentence_starts.mjs,scripts/benchmark.mjs,tests/test_head_int8.py learn=test: tests/test_dnp_cld3.py and tests/test_head_int8.py fail if a helper reads boosted scores again
2026-11-03T06:40:35Z s=b132b503 FINDING docs/index.html:restrict example learn=test: make e2e runs the example with its stated output (23 examples passed)
2026-11-03T06:40:35Z s=b132b503 FINDING e2e/site.spec.mjs:demo boost learn=test: site e2e covers both states
2026-11-03T06:40:35Z s=b132b503 FINDING .vae/MEMORY.md:fastText predict learn=memory: narrowed scope per evidence (tests/fasttext.test.ts)
2026-11-03T07:28:07Z s=b132b503 DONE fp=b85401409221 cov=96.9% paths=ARCH.md,README.md,defuss_lid/__init__.py,docs/assets/site.css(+20)
2026-11-03T07:28:07Z s=b132b503 FINDING tests/test_dnp_cld3.py, ARCH.md:35, src/boost.ts:24, scripts/sentence_starts.mjs:9 learn=none: follows a one-off maintainer decision; no mechanical rule needed
2026-11-03T07:44:07Z s=b132b503 FAIL tests.e2e.1
2026-11-03T07:57:48Z s=b132b503 FAIL tests.e2e.1
2026-11-03T08:01:26Z s=b132b503 DONE fp=b97844a2cc5e cov=96.9% paths=.github/workflows/verify.yml,ARCH.md,Makefile,README.md(+39)
2026-11-03T08:01:26Z s=b132b503 FINDING e2e/site.spec.mjs:74 (hero test) learn=test: generated block + cross-check, so a new pack release cannot leave the hero stale
2026-11-03T08:01:26Z s=b132b503 FINDING docs/index.html cards + accuracy table (user requirement) learn=verifier: sizes.mjs throws if a card's pack or alternative lacks a Default results row; verify.mjs flags stale blocks
2026-11-03T08:01:26Z s=b132b503 FINDING documentation/results-dno-pq.md:46 and README.md:140 (rule B) learn=none: a causal claim without a measurement; the prose gate cannot detect it
2026-11-03T08:01:26Z s=b132b503 FINDING documentation/results-dno-pq.md:38 (rule P) learn=none: wording fix
2026-11-03T08:01:26Z s=b132b503 FINDING README.md:15 (rule P) learn=none: wording fix
2026-11-03T08:01:26Z s=b132b503 FINDING README.md:24, ARCH.md:7 (rule P) learn=none: wording fix
2026-11-03T08:01:26Z s=b132b503 FINDING README.md:232 (rule R) learn=none: wording fix
2026-11-03T08:01:26Z s=b132b503 FINDING documentation/results-dno-pq.md:7 (rule B) learn=none: wording fix
2026-11-03T08:01:26Z s=b132b503 FINDING scripts/benchmark.mjs:1 (docs) learn=none: comment fix
2026-11-03T15:27:16Z s=b132b503 DONE fp=7a8e5b60279a cov=97.0% paths=.github/workflows/verify.yml,ARCH.md,Makefile,README.md(+44)
2026-11-03T15:27:16Z s=b132b503 FINDING defuss_lid/cli.py:93 main (callers defuss_lid/compress.py:79, defuss_lid/subset.py:146) learn=test: tests/test_cli.py::test_compress_and_subset_read_a_pack_with_bucket_gaps compares the outputs of a gap source and its 4-byte form byte for byte
2026-11-03T15:27:16Z s=b132b503 FINDING defuss_lid/runtime.py:_with_bucket_ids learn=test: the same CLI test asserts byte-identical subset output
2026-11-03T15:27:16Z s=b132b503 FINDING documentation/architecture.md:24 P (precision); src/index.ts:withBucketIds; defuss_lid/runtime.py:bucket_gaps learn=none: a wording fix; no rule kind can check that a cited measurement covers its stated population
2026-11-03T17:20:10Z s=b132b503 FINDING dnp-tools/fastText/edit.py main; dnp-tools/fastText/synth.py written learn=memory-none: a direct codebook edit on hand-written synthetic text raised der_3's selection split 98.29->98.36 (boost) but made 498 vs 496 test errors; Markov text lowered the selection split; the step-10 packs stay shipped
2026-11-03T18:23:27Z s=b132b503 FINDING dnp-tools/fastText/refit.py --drop-source; dnp-tools/fastText/selection.py learn=memory-none: fit-source ablation; no leave-one-out or doubled-source run beat the step-10 packs on a fixed selection split (paired sign test); reruns flip ~1,100 deferi_6 selection texts each way, so gains under ~0.1 pt are noise
2026-11-03T18:47:24Z s=b132b503 FINDING dnp-tools/fastText/refit.py --budget-scale learn=memory-none: 10% more bytes (+687/+1,332 rows) left the fixed selection split within noise (p 0.87/0.16), and lid.176 with all 50,000 rows scores 1-2 pt below the shipped packs; rows are not the limit
2026-11-03T20:29:07Z s=b132b503 FAIL lint,tests.e2e.1,coverage,repo.structure
2026-11-03T20:38:05Z s=b132b503 FAIL tests.e2e.1
2026-11-03T20:39:18Z s=b132b503 FINDING src/boost.ts CLD3_BOOST_WEIGHT; e2e/site.spec.mjs learn=test: per-runtime boost defaults tuned on the selection split (dnp-tools/boost); CLD3 gains up to 20 then flat, fastText best at 1; tests/boost.test.ts asserts each runtime's default; the site test reads the weight from the runtime copy instead of pinning 1
2026-11-03T20:42:27Z s=b132b503 DONE fp=4b3b935f24af cov=97.0% paths=.github/workflows/verify.yml,ARCH.md,Makefile,README.md(+44)
2026-11-03T20:42:27Z s=b132b503 FINDING e2e/site.spec.mjs:154 demo: the letter boost re-ranks by alphabet learn=test: the e2e test derives the expected score from the runtime constant, so a retuned weight cannot leave it stale; tests/boost.test.ts asserts each runtime's default
2026-11-03T20:42:27Z s=b132b503 FINDING README.md:138 (B evidence); documentation/results-dno-pq.md Letter boost (B evidence) learn=none: a claim's scope against its measurement has no mechanical check; caught by reading the per-pack sweep
2026-11-03T20:42:27Z s=b132b503 FINDING src/boost.ts BOOST_WEIGHT, CLD3_BOOST_WEIGHT; src/cld3-pack.ts:303; src/cld3.ts:56 learn=test: tests/boost.test.ts covers both defaults and the explicit-weight path
2026-11-03T21:49:12Z s=b132b503 DONE fp=e25b30c3f1bc cov=97.0% paths=.github/workflows/verify.yml,ARCH.md,Makefile,README.md(+44)
2026-11-03T21:49:12Z s=b132b503 FINDING models.lock.json kyr0/cld3-pq-dno; README.md:50; docs/assets/site.js:86; docs/index.html:199,704; documentation/results-dno-pq.md learn=verifier: fetch-models --live and the e2e lock/URL checks already catch a revision or hash drift
