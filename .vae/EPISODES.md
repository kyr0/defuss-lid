# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-11-02T08:59:43Z s=d9c6d40f FAIL prose,env.example,lint
2026-11-02T09:01:27Z s=d9c6d40f FAIL prose,lint
2026-11-02T09:10:46Z s=d9c6d40f FAIL prose
2026-11-02T09:19:42Z s=d9c6d40f DONE fp=772183283e6b cov=96.3% paths=.claude/settings.json,.github/workflows/verify.yml,.oxlintrc.json,AGENTS.md(+240)
2026-11-02T09:19:42Z s=d9c6d40f FINDING src/index.ts:LidModel.predict learn=test: tests/fasttext.test.ts 'flat softmax: threshold applies to the probability' (p=t-5e-6 rejected, t+5e-6 accepted)
2026-11-02T09:19:42Z s=d9c6d40f FINDING defuss_lid/runtime.py:Model.predict learn=test: tests/test_core.py::test_softmax_threshold_uses_raw_probability_like_fasttext
2026-11-02T09:19:42Z s=d9c6d40f FINDING defuss_lid/runtime.py:Model.predict + src/index.ts:LidModel.predict learn=test: shared rule: no character outside fastText's separators; tests/fasttext.test.ts and tests/test_runtime.py::test_blank_text_rule_matches_the_js_runtime
2026-11-02T09:19:42Z s=d9c6d40f FINDING defuss_lid/format.py:load learn=test: tests/test_format.py::test_malformed_header_raises_value_error
2026-11-02T09:19:42Z s=d9c6d40f FINDING src/container.ts:parseContainer learn=test: tests/container.test.ts 'malformed files fail with specific errors'
2026-11-02T09:19:42Z s=d9c6d40f FINDING defuss_lid/runtime.py:Model.__init__ learn=test: tests/test_runtime.py::test_subset_path_nodes_must_be_unsigned
2026-11-02T09:19:42Z s=d9c6d40f FINDING defuss_lid/cli.py:main learn=test: tests/test_cli.py::test_predict_on_a_cld3_pack_explains_the_runtime
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/serve.mjs:createStaticServer learn=test: tests/serve.test.ts: /%E0%A4%A returns 400 and the server keeps serving
2026-11-02T09:19:42Z s=d9c6d40f FINDING README.md + docs/index.html sizes learn=verifier: scripts/verify.mjs checks 'sizes' (README table recomputed) and 'pack-sizes' (kB column vs registry)
2026-11-02T09:19:42Z s=d9c6d40f FINDING documentation/results-v0.3.md + scripts/report_v03.py reproduce block learn=verifier: block now runs `bun run build`; e2e checks every cli line against package scripts and --help
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/browser_check.mjs learn=none: replaced by a shim to scripts/e2e.mjs; parity lives in e2e/parity.spec.mjs
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/reproduce_v02.py learn=none: repointed; stage not executed here (needs downloaded corpora)
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/package_release.py:excluded learn=none: exclusions added; not executed because it rewrites SHA256SUMS
2026-11-02T09:19:42Z s=d9c6d40f FINDING scripts/verify_native.py learn=none: import moved after argument parsing; not run with fastText installed
2026-11-02T09:38:51Z s=d9c6d40f DONE fp=156ad3c11ddf cov=96.3% paths=.claude/settings.json,.github/workflows/verify.yml,.oxlintrc.json,AGENTS.md(+240)
2026-11-02T09:38:51Z s=d9c6d40f FINDING scripts/sizes.mjs:reportRows learn=test: e2e/site.spec.mjs accuracy test matches each generated row, including the 2-decimal pack kB that only the Compression results table has, against results-v0.3.md
2026-11-02T09:38:51Z s=d9c6d40f FINDING README.md:156 packs paragraph learn=none: prose comparison, not mechanically checkable; the figures it summarizes are generated and verified
2026-11-02T09:38:51Z s=d9c6d40f FINDING e2e/site.spec.mjs:packs all-in sum learn=test: the corrected assertion runs in all three engines
2026-11-02T09:44:39Z s=d9c6d40f FAIL tests.e2e.1,coverage
2026-11-02T09:44:49Z s=d9c6d40f FAIL tests.e2e.1
2026-11-02T09:46:43Z s=d9c6d40f DONE fp=bc52fc809e07 cov=96.3% paths=.claude/settings.json,.github/workflows/verify.yml,.oxlintrc.json,AGENTS.md(+101)
2026-11-02T09:46:43Z s=d9c6d40f FINDING scripts/sizes.mjs:reportRows learn=test: e2e/site.spec.mjs accuracy test matches each generated row, including the 2-decimal pack kB only that table has, against results-v0.3.md
2026-11-02T09:46:43Z s=d9c6d40f FINDING e2e/site.spec.mjs:packs budget table learn=test: passes in chromium, firefox and webkit
2026-11-02T09:46:43Z s=d9c6d40f FINDING gate run (operational) learn=memory: .vae/MEMORY.md line 'gate runs'
2026-11-02T09:53:55Z s=d9c6d40f DONE fp=5a594d446bc7 cov=96.3% paths=.claude/settings.json,.github/workflows/verify.yml,.oxlintrc.json,AGENTS.md(+100)
2026-11-02T09:53:55Z s=d9c6d40f FINDING .gitignore:dist/ learn=verifier: scripts/verify.mjs site-runtime-copy now runs git check-ignore over the site files; a probe re-adding `dist/` failed with 8 findings
2026-11-02T09:53:55Z s=d9c6d40f FINDING SHA256SUMS, scripts/package_release.py, scripts/browser_check.mjs learn=none: one-time cleanup requested by the maintainer
2026-11-02T09:53:55Z s=d9c6d40f FINDING scripts/coverage.mjs + docs/index.html coverage block learn=verifier: `make coverage` runs scripts/coverage.mjs --check after measuring
