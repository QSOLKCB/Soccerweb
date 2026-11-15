# Tournament Lab evidence

These are executed results, with source boundaries kept explicit. The lab never changes football rules or treats model observations as scores. [Implementation PR #10](https://github.com/QSOLKCB/Soccerweb/pull/10) contains the final-head CI checks; it remains unmerged until owner review.

| Check | Source / result |
| --- | --- |
| Unmodified season baseline | Post-PR-7 main `4d67655ce6b5dcb1f071118b03f7e6d80d7ba10b`; 96/96 full time; exit 0 |
| Exact golden comparison | All 96 fixture positions, hashes **and every legacy metric** match; [receipt](ci-golden.json) |
| Measured 1,000-fixture sweep | Clean implementation `99a60c73a614a4ca82df5d65bd915da9c835d5aa`; 1,000/1,000 full time; 12/12 reruns identical; exit 0 |
| Native regressions after receipt hardening | Clean `acdb6ae495191c9ef790ccc51af69f766c7a9d89`; **129 PASS**, no failures/skips; [log](native-tests.txt), [measurement](native-measurement.json) |
| Real sparse Chromium/Firefox captures | [Lab CI run 43696573245](https://github.com/QSOLKCB/Soccerweb/actions/runs/43696573245), head `99a60c7`, Actions merge checkout `32c2f715688274f7e5b9e31b87f54856809fd06a`; both PASS, native/browser final hashes equal |
| Existing full-game and GOALPOSTS browser regression | [Pages verification 43696573137](https://github.com/QSOLKCB/Soccerweb/actions/runs/43696573137), head `99a60c7`: verify and GOALPOSTS jobs PASS; deployment SKIPPED |
| Disabled VLM | [SKIPPED receipt](ci-vision-disabled-audit.json); no weights, inference API, GPU or download |
| 10,000 performance / real VLM / GPU | **NOT RUN** |

The measured sweep and initial browser capture share code SHA256 **`c49207c0a69e03d01c9ee1cb045a7658506f529ce9f43a5b2a470d850bd3934a`**, although GitHub's synthetic merge commit differs from the branch HEAD. The later `acdb6ae` commit bounds metadata, requires receipt provenance, clarifies shard denominators, and writes the final receipt only after successful report generation. It does not change fixture scheduling, simulation, metrics, anomaly detection or browser rendering. Its new failure/provenance tests are included in the 129-test run. The final documentation commit has no executable changes. See the PR's checks for final clean-head CI, rather than attributing older artifacts to a newer SHA.

## Actual 1,000-match measurement

Command:

```sh
node tools/tournament_lab.mjs --preset medium --out work/tournament-1000 --budget-seconds 1200 --verify
```

Default 120 active seconds per fixture, eight published seeds expanded through mirrored pairs, both grounds, three difficulties, clear/rain; one native process, no browser/model in the sweep. Linux 6.18.57 x86_64, Node **24.22.1**, AMD EPYC 9V74 virtual CPU, five logical CPUs, **18,882,662,400 bytes RAM** reported by Node. No GPU was used. Host details are in the receipt; other local validation processes occasionally overlapped, so this is an observed throughput, not an isolated hardware benchmark or service guarantee.

| Measurement | Observed |
| --- | --- |
| Completed fixtures | 1,000 |
| Recorded simulation ticks | 8,879,500 |
| Wall, including report generation | 432.028 seconds |
| CPU, including report generation | 431.972 seconds |
| Throughput | 2.315 fixtures/s; 20,553 ticks/s |
| Peak RSS, including report | 101,872 KiB (~99.5 MiB) |
| Representative deterministic reruns | 12, all equal including telemetry |
| Failed fixtures | 0 |
| Goals / draws / margins ≥5 | 4,197 / 262 / 38 |
| Review candidates | 136 repeated-frame contacts, 17 pass chains, 38 blowouts, 62 scoreless results |

The console measurement includes report work; this initial revision's stored receipt precedes report generation and reports **431.919 seconds / 96,752 KiB**. Both are retained so the difference is visible. The hardened runner writes its final receipt after report generation. Throughput counts 1,000 unique fixtures; rerun CPU/wall overhead is included, and rerun ticks are not added to the numerator. No balance or human-fun conclusion follows from these results. Flags were retained without adjusting scores or thresholds to hide them.

[Manifest](1000-manifest.json) · [receipt](1000-receipt.json) · [final console measurement](1000-console.json) · [summary and flag counts](1000-summary.json) · [complete portable run bundle](1000-run.tar.gz).

The gzip/tar bundle retains **every raw NDJSON fixture**, full analytics/anomalies, manifest, receipt, sampling plan and standalone HTML report. Extract into a fresh work directory and open `1000-run/index.html` locally. The raw journal SHA256 is recorded in the receipt; [SHA256SUMS](SHA256SUMS) also covers the bundle and archived evidence. Fixture hashes, seeds, teams/config and trigger ticks remain available for deterministic reproduction from the recorded source checkout. The report can be inspected without installing Node or starting a server.

## Genuine browser frames

Playwright **1.56.0**, GitHub-hosted Ubuntu 24.04, Node 22/Python 3.12; Chromium **141.0.7390.37**, Firefox **142.0.1**. The CI sweep was 24 fixtures of 20 active seconds, then a two-fixture Chromium sample and one-fixture Firefox control sample. Chromium saved **5 images** (one full-time endpoint deduplicated), Firefox **3**. These are sparse Canvas captures, not live frame-pacing measurements, authored snapshots or human gameplay tests.

| Archived frame | Provenance |
| --- | --- |
| [Chromium fixture 0, tick 1675](chromium-f0-t1675.png) | [Full Chromium report](ci-chromium-report.json); actual Canvas, 1280×900, DPR 1 |
| [Firefox fixture 4, tick 1059](firefox-f4-t1059.png) | [Full Firefox report](ci-firefox-report.json); actual Canvas, 1280×900, DPR 1 |

The read-only inspection page deliberately omits application HUD/audio/menus. Pixel diversity/variance checks passed; per-frame checksums, camera/ball coordinates and channel-change fractions are recorded. Rendering left the simulation hash unchanged, and each complete re-simulation matched native final hash/tick. No cross-browser pixel equality or camera smoothness claim is made. The reports retain all eight image receipts; the two frames linked above are archived permanently here. The full portable image index is in CI artifact **`tournament-smoke-evidence`**, ID **14154666920**, ZIP SHA256 **`855e2cd6881019616c927104983a7f596a2e9aa14a60bbe63d15115d2af4a4ce`**, with seven-day retention.

Existing full-app Chromium/Firefox and GOALPOSTS/controller/offline suites run separately in Pages verification. They are not replaced by this narrow capture harness. Final-head pass/fail and run links are recorded on the PR. Human play/listening, physical USB SNES hardware, Safari/WebKit and laptop profiling remain **NOT RUN**.
