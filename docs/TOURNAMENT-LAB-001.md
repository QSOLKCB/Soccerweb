# Tournament Lab — reproducible football evidence

A development-only lab built on post-PR-7 main **`4d67655ce6b5dcb1f071118b03f7e6d80d7ba10b`**. It calls the existing `createState`, `step` and `stateHash`; it does not tune football, change replay v5, or add a runtime dependency. Native ESM and Node's standard library handle the sweep. Python/Playwright is optional for sampled images; a locally provisioned vision runtime is a further optional step.

**Simulation → telemetry → bounded browser samples → optional local vision → offline report.** Scores, physics and replay checks remain authoritative. An anomaly or model observation is a review candidate, not proof of a defect. AI-v-AI results do not establish human fun, difficulty fairness or causation.

## Run a bounded sweep

Node 22+; no npm install. From the repository root:

```sh
mkdir -p work
node tools/tournament_lab.mjs --help
node tools/tournament_lab.mjs --out work/quick --verify
node tools/tournament_lab.mjs --preset medium --out work/1000 --budget-seconds 1200 --verify
# Explicit large request only; no scheduled or automatic large runs:
node tools/tournament_lab.mjs --preset large --out work/10000 --budget-seconds 7200 --verify
```

Open `work/quick/index.html` directly in a browser. The report has no scripts, CDN, network calls or server requirement. JSON and NDJSON links are adjacent. A fresh output directory is required. Existing output is never replaced by a new sweep. Parent directories must exist.

| Option | Bound / meaning |
| --- | --- |
| `--preset quick / medium / large` | 96 / 1,000 / 10,000 fixtures |
| `--max-fixtures N` | Even canonical prefix, 2–10,000; never an unbounded loop |
| `--seeds 42,731` or `--seeds 1:16` | Inclusive ranges, 1–256 distinct seeds, unsigned 32-bit nonzero |
| `--mode both / outdoor / indoor` | Regulation AI fixtures; never human GOALPOSTS routes |
| `--seconds N` | 20–720 active seconds, default 120 |
| `--shard-count N --shard-index I` | 1–32 shards, zero-based index; fixed ID modulo count |
| `--budget-seconds N` | 1–7,200 seconds per invocation, default 600 |
| `--fixture-ms N` | 1–60,000 ms per fixture, default 60,000; 120,000 hard tick ceiling |
| `--verify` | Repeat up to 12 representatives, one per ground/difficulty/weather stratum |
| `--resume` | Same source SHA, code digest, dirty flag, config and shard only; required verification cannot be dropped |

Exit **0 = PASS**, **2 = PARTIAL** (budget, interruption, incomplete verification), **1 = FAIL/invalid invocation**. A completed fixture may still have heuristic flags; these do not fail a run. Failed fixtures remain in the journal and prevent PASS. A run-budget interruption records its attempted fixture and restarts that fixture from its seed on resume. SIGINT/SIGTERM are handled at fixture boundaries; time checks occur every 256 ticks. SIGKILL can leave a torn append; resume salvages only the final non-newline-terminated record into `.torn-tail`, retaining every earlier complete row. Interior corruption is an error.

```sh
# Repeat the original options exactly; a larger wall budget is allowed.
node tools/tournament_lab.mjs --out work/quick --resume --verify --budget-seconds 1200
```

Each fixture is appended and fsynced. Atomic receipts update every 10 fixtures and at completion; the journal is authoritative after a crash, so a prior RUNNING receipt can lag. A per-output process lock prevents concurrent writers; dead same-host process locks are recoverable. Locks from another host require manual inspection. A hard crash never writes a PASS. Invalid resume attempts preserve an existing receipt. At most 32 resume sessions are recorded.

## Schedule, provenance and schema 1

The default quick preset is **exactly** the old 96-fixture season order: outdoor then indoor; Club/Pro/Elite; seeds `42,1988,731,19,2026,805,99,31415`; each seed's club against the club three slots later, then reversed. Both teams use the production AI with neutral external inputs. No canvas/audio/model is created during a sweep.

Expanded schedules repeat the ground/difficulty/seed grid, alternate clear/rain by cycle, rotate the opposition after each clear/rain pair, and increment seeds after all seven opponents. Each adjacent even/odd ID is a mirrored pair with identical ground, difficulty, weather and seed. Indoor rain is a recorded config stratum, not a claim that indoor physics uses rain. Arbitrary even prefixes may weight some strata unevenly; the report exposes denominators. Shards can split pairs; paired-bias analysis uses complete pairs only. Fixture order depends on configuration, never worker speed or completion order. Parallelism is explicit independent CPU processes/shards, without a thread pool or npm worker package.

`manifest.json` records schema 1, simulation/replay 5, canonical options, shard, schedule SHA256 and source provenance. Provenance includes Git HEAD, dirty status for fingerprinted executable files, and a SHA256 over sorted simulation, AI, mode, replay, renderer and lab source-file digests. The code digest makes modified lab code distinguishable; release evidence should use a clean checkout. Generated output and unrelated documentation files do not affect this code-specific dirty flag, so an unignored output directory cannot invalidate its own resume. Git SHA alone is not a claim about uncommitted code.

`fixtures.ndjson` holds one sealed JSON row per attempted completed/failed fixture:

- `schema`, `simulationVersion`, `source`, `fixture: {id,pair,reverse,config}`.
- `status: COMPLETE | FAILED`, `error`, `metrics` (legacy season metrics), `telemetry` (bounded flags, events, histogram, input contract).
- `checksum`: SHA256 of the JSON payload before the checksum field. This detects accidental corruption; it is not an authenticity signature.

`receipt.json` holds status, count, verification results, exact invocation, environment, CPU/wall time, maximum RSS, throughput per session and journal checksum. Resume throughput counts newly completed fixtures; repeated verification and abandoned work contribute to wall/CPU time. RSS is the process high-water mark in KiB. The journal has a 128 MiB/10,000-row cap on reads, individual rows a 32 KiB cap and JSON metadata a 1 MiB cap; result and report memory is bounded by the configured maximum rather than an unbounded stream. Frames, full states and replay input arrays are not retained for every fixture.

The executable schema validator is `tools/tournament_io.mjs`: it checks checksum, version, canonical config, shard membership, source, array lengths, numeric bounds, results and telemetry before merging/rendering. Browser playback reconstructs the same neutral-input AI stream and verifies the final native hash. It does not relabel authored snapshots as real gameplay.

## Shards and safe merging

```sh
node tools/tournament_lab.mjs --preset medium --shard-count 2 --shard-index 0 --out work/s0 --budget-seconds 1200 --verify
node tools/tournament_lab.mjs --preset medium --shard-count 2 --shard-index 1 --out work/s1 --budget-seconds 1200 --verify
node tools/tournament_lab.mjs merge --inputs work/s1,work/s0 --out work/merged
node tools/tournament_lab.mjs report --inputs work/merged --out work/report-copy
```

Independent shards may run concurrently. Merge sorts by fixture ID and rejects duplicate shards/fixtures, mismatched code/config/shard counts, corruption and false PASS receipts. Missing fixtures, failed shards and incomplete verification cannot be promoted to PASS. Raw per-shard receipts remain nested in the merged receipt, preserving each environment and timing. Parallel wall time is not the sum of shard times; inspect individual sessions. To merge an interrupted process whose receipt lags, resume it first to reconcile its journal and receipt. The separate `report` command preserves an individual shard’s assignment, denominator and status; it does not turn that shard into a partial whole-tournament merge.

## What the report means

The old `tests/season_report.mjs` is untouched. Its definitions are copied faithfully into the lab and checked against the checked-in post-#7 golden report:

- Possession spell: consecutive active ticks with the same owning player; a stoppage closes it. Short: under 20 ticks. First-touch loss: under 3 ticks, including intentional kicks, so not necessarily a turnover.
- Interception: pass changes last-touch team during continuous play, including deflections; restart assignment excluded. Direct turnover: ownership changes directly between opposing players.
- Crowding: same-team pairs within 30 px, sampled every 30 active ticks. Goals/shot attempts is descriptive conversion, not shot-level xG.
- Blowout: absolute margin at least five. Saves/tackles/pass attempts/completions/possession ticks come from the game. No invented fouls, cards or offside stats.

W/D/L and totals are grouped by club, difficulty, ground, weather, starting side and seed. The paired orientation metric averages first-slot goal margin over each reversed pair; it concerns starting slots, not physical ends after halftime. Ranking distributions group by seed/difficulty/ground/weather, sort points per played match, then margin per match, then club ID; they are schedule-dependent diagnostic rankings, not a simulated Cup or full league. Tied ranks use this explicit deterministic tiebreaker. Possession histogram bins are `<3`, `3–19`, `20–59`, `60+` ticks. The Wilson 95% interval for first-slot wins is descriptive: fixtures share seeds/opponents and are not independent samples of human play.

| Candidate | Exact trigger | Limit |
| --- | --- | --- |
| Incomplete | Tick ceiling or per-fixture time budget | Failure with diagnostic, never a fabricated full-time result |
| Repeated frame contact | Two post/crossbar events less than 60 ticks apart | Could be a legitimate rebound |
| Frame/goal adjacency | Goal within one tick of a post event | Review geometry; does not assert a collision bug |
| Keeper hold | Keeper-owned ball for 180 consecutive active ticks | Owner can change between keepers; no causal inference |
| Idle ball | Planar speed below 0.25 px/tick for 300 active ticks | No stopped-play time counted |
| Non-progressing ball | Within 40 px of a fixed anchor for 600 active ticks | Anchor resets after leaving that region |
| Pass chain | 24 pass attempts with no intervening non-pass kick or stoppage | Does not prove a repeated-player loop |
| Crowding | Mean above three close same-team pairs per sample | Aggregate flag is at the final tick |
| Blowout / scoreless | Margin ≥5 / no goals | Results alone do not establish bad AI |

Each flag retains fixture ID, seed/teams/full config, tick, exact state hash at the trigger, final hash and neutral-input context. Up to one of each kind is retained per fixture; the first 24 goal/post/save events and aggregate event counts accompany it. The report shows the first 100 prioritized flags and retains every flag in JSON. Failed rows are excluded from win-rate/ranking calculations and retained in diagnostics. The lab deliberately omits GOALPOSTS balance claims: existing authored stage routes remain the separate `tests/goalposts_report.mjs` regression suite.

## Sparse real-browser evidence

On a supported browser test host, install **development-only** Playwright 1.56.0 and its Chromium/Firefox builds as in the README. Then:

```sh
python tools/tournament_capture.py --run work/quick --out work/quick-chromium --limit 4 --controls 1
python tools/tournament_capture.py --run work/quick --out work/quick-firefox --limit 2 --controls 1 --browser firefox
```

Capture validates the run receipt against the current checkout and requires PASS, including every requested representative verification. Missing, partial, failed or inconsistent receipts are rejected before opening a browser. At most **8 fixtures × 3 PNGs**, 32 MiB total, 240-second loop budget; a workflow supplies an additional job timeout. It chooses priority anomalies plus SHA256-ranked pseudorandom controls, reproducibly and without replacement. Each event window samples trigger−30, trigger, trigger+30 ticks, clamped to the match. Limited samples cannot establish whole-game visual correctness.

The narrow read-only harness re-simulates production AI from config with no injected score, position or outcome, uses production `Renderer.draw`, and warms the camera/trail for 120 ticks before each sample. It asserts rendering did not mutate the simulation and compares the final state hash/tick with the native receipt in each browser. Images are **genuine rendered Canvas screenshots**, not authored state snapshots or real-time clips. The inspection page omits app HUD, menus and audio and does not measure RAF smoothness. Existing full app browser tests still cover those flows. This adapter cannot assess HUD occlusion or physical displays.

`report.json`, `plan.json` and the portable `index.html` include source, fixture checksum, tick/active-time mapping, viewport, DPR, browser/version, camera/ball projection, image size/SHA256 and page errors. The non-VLM baseline asserts sampled Canvas color diversity/variance to reject blank output, reports downsampled channel-change fraction between frames, and records known ball/camera geometry. Pixel-change statistics are diagnostic, not proof of a freeze or animation bug. No cross-browser bit-identical rasterization is assumed.

## Optional local vision: adapter scaffold, disabled unless provisioned

```sh
# This works without a model or browser evidence and explicitly records SKIPPED:
node tools/vision_audit.mjs --out work/vision-skipped
# Only after the owner has approved/provisioned a trusted local runtime and model:
node tools/vision_audit.mjs --captures work/quick-chromium --out work/local-audit --config /absolute/path/to/approved-local-manifest.json
```

This tier delivers the manifest-validated adapter and mocked tests. A concrete selected/pinned model/runtime/projector combination and temporal multi-frame vision review are **deferred**; the delivered example cannot enable real inference reproducibly by itself. Moving GOALPOSTS geometry and goalkeeper freezing are not evaluated by this still-image regulation-match adapter. The issue permits verified lower tiers when provisioning is unavailable; simulation and sampled-browser evidence are the completed tiers.

No remote API, HTTP inference endpoint, automatic downloads, weights or GPU runner is included. The adapter executes an explicitly pinned **installed llama.cpp `llama-mtmd-cli`** directly without a shell. Start from `tools/vision-manifest.example.json`; it is intentionally invalid until the owner supplies exact identities/revisions, quantization, runtime version, absolute paths, SHA256 digests, licenses and provenance for runtime, model and matching vision projector. File hashes are streamed and checked before invocation; missing provisioning or insufficient declared available RAM returns SKIPPED. Hash/license/provenance configuration errors return an auditable ERROR.

For a first CPU trial on a host with sufficient free RAM, consider a compatible small 2–4B multimodal model at 4-bit quantization and budget roughly **8–12 GiB available RAM**, including projector/context/runtime overhead. This is an estimate, not a benchmark or a selected/provisioned model. Confirm the specific build's multimodal CLI flags and model/projector compatibility before enabling; no runtime version or weight identity has been tested here. The manifest must declare 2–128 GiB minimum RAM and 1–8 CPU threads. Context is capped at 2,048, generation at 512 tokens, temperature 0, seed 1988; CPU inference only. Actual peak inference memory is **NOT MEASURED**, and the availability check is not an OS memory sandbox. Run only a trusted binary on an appropriately isolated host.

At most eight images, one image per call, 60-second subprocess timeout, 64 KiB process-output limit, bounded raw stdout/stderr. The versioned prompt asks only for visible details and explicit uncertainty; strict JSON validates field names, image/tick identity, categories, verdicts, lengths and at most eight observations. A single still cannot prove an AI freeze, hidden-state error, fairness or scoring correctness. Invalid JSON, extra keys, errors/timeouts and raw model output remain data in `audit.json`; none is executed, interpolated into HTML, used to change a match, or used as a CI gameplay assertion. All model results are advisory. The adapter is mocked in unit tests; real inference is **NOT RUN**.

## CI, cost and owner gates

- `tournament-smoke.yml`: PRs use Ubuntu 24.04 GitHub-hosted CPU, Node 22/Python 3.12, pinned action SHAs and Playwright 1.56.0. It runs lab tests, exact golden comparison, 24 short fixtures, disabled vision, and at most nine browser images. Twelve-minute job cap, 128 MiB artifacts, seven-day retention. No model/GPU, deployment or write permission.
- `tournament-lab.yml`: manual only, allowlisted owner **EmergentMonk**, repository **QSOLKCB/Soccerweb**, **protected `main` only**. Four hosted CPU shards, medium/large choices, 600/1,200/1,800-second shard budgets, 35-minute jobs, one workflow at a time, 128 MiB per-shard artifacts, seven-day retention. Failed shards keep evidence; canonical merge does not hide failure. No browser or model in this sweep workflow.
- Main was reported **unprotected** during implementation. The large workflow intentionally skips until the owner configures branch protection after review/merge. This PR does not modify repository protection or register runners. Ordinary PR smoke is unaffected.
- Existing `pages.yml`, deploy conditions and service-worker asset list are unchanged. The packaging allowlist excludes lab scripts, reports, README banner and optional model configuration.

Future GPU setup requires explicit owner approval **before** installation or registration:

1. Choose the licensed model/revision/quantization/projector and verify downloads/checksums; agree on CPU/GPU/RAM/disk and maximum inference time.
2. Choose an isolated ephemeral or dedicated host and locked-down runner group; never expose a personal desktop/home or other repositories. Prefer local/offline audit first.
3. Restrict execution to approved protected-main code and owner dispatch; never `pull_request`, `pull_request_target`, fork refs or arbitrary input commands on a persistent self-hosted GPU.
4. Minimize secrets and network reach, validate signed/hashed input artifacts, enforce resource/artifact caps, destroy ephemeral state after the run, and document revocation/cleanup.
5. Re-review the workflow separately. This delivery has no GPU deployment, enrollment or hidden inference step.

## Executed evidence and limits

The unchanged 96-fixture post-#7 baseline completed in **40.08 seconds** wall / **41.17 seconds** CPU on the local Linux host (Node 24.22.1, AMD EPYC 9V74 virtual CPU, five logical CPUs, roughly 17.6 GiB RAM). Peak child-process RSS was **73,524 KiB**. Every fixture reached full time. The first new-runner comparison matched **all legacy fields and hashes exactly**, before adding analytics.

[Golden report](evidence/tournament-lab/golden-season.json) · [baseline measurement](evidence/tournament-lab/baseline-measurement.json). **The measured 1,000-fixture run passed:** 8,879,500 ticks in 432.028 seconds, 2.315 fixtures/s, 20,553 ticks/s, 101,872 KiB peak RSS including report generation, and 12/12 exact reruns. [The evidence record](evidence/tournament-lab/README.md) preserves the full raw run bundle, exact source boundaries, checksums, 132 passing native tests (with separate source receipts for the initial run and review fixes), and genuine Chromium/Firefox capture receipts. A supported 10,000-fixture preset is not an executed performance result.

**10,000-fixture performance run, real VLM inference, GPU performance, human play/listening, physical USB SNES hardware, Safari and laptop profiling: NOT RUN.** Browser verification uses genuine hosted Chromium/Firefox with virtual inputs where appropriate. No claim of human fun or fairness follows from a green automated run.
