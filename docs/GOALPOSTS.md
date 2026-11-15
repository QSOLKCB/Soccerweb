# GOALPOSTS — The Andrew Rusher Edition

An optional outdoor **5 v 5, solo** arcade challenge, added to merged Phase 3 (`b086c70a0d9e9490384ec09ce0c1b811cfe32d66`). Quick Match, local two-player, Cup, Challenge and Practice retain their rules. Open **GOALPOSTS** in the clubhouse, choose Club/Pro/Elite and accept the current standard. The optional dedication contains no likeness, personal details, attribution of fictional dialogue, allegation or implied endorsement.

[The Standards Have Changed](GOALPOSTS-POLISH-001.md) adds fictional committee notices, numbered revisions, approval stamps and a victory ledger while preserving these rules, replay v5 and the huge-pitch/tiny-player view. **CURRENT STANDARD** remains attached to the real opening in every stage. Settings → Minimal motion & effects or OS reduced motion suppresses the short stamp animation; gameplay warnings and actual post motion remain visible.

## Complete three standards

| Stage | Attacking opening | Objective |
| --- | --- | --- |
| Moving the Goalposts | 180 pixels wide; slides left/right | Score one goal |
| Raising the Standard | Centred; resizes between 180 and 140/130/120 pixels at Club/Pro/Elite | Score one goal |
| The Rules Have Changed | Sliding and resizing together | Earn two points: any goal = one, a shot curved at release = two |

Curved-shot credit survives a parry or frame bounce, but a new controlled possession, tackle or kick ends it. All goals count immediately; none are retroactively reversed. Two ordinary goals can clear the last stage. Your defending goal is always centred and 150 pixels wide. The gold goal is your target.

Each stage permits **90/75/60 active seconds** at Club/Pro/Elite. Two goals conceded in that stage or an expired timer ends the run. A new stage starts from an attacking set-piece arrangement with real teammates, defenders and a keeper. After a goal that does not finish the stage, the same arrangement resets, preserving elapsed time and points. Ordinary misses and saves remain real football: recover, defend, pass and shoot again. The clock and posts stop during kickoff, throw-ins/goal kicks, celebrations, stage screens, pause and goal replays. There is no halftime in this mode.

The stage screen offers Next stage, retry the whole run, replay export and clubhouse. A victory or failure offers retry and export. Fastest completed active time is saved separately for each difficulty under `soccerweb.goalposts.v1`; malformed data is discarded, only three bounded records are retained. Replays cannot update bests. Entering/leaving this mode never advances a cup or changes practice state or football preferences.

## Controls and a first successful shot

Use your existing keyboard or gamepad mapping. Move diagonally up/right from the opening left-hand setup while charging, then face up and release. Holding a curve key/shoulder at release can bend across the keeper. Watch the announced shift instead of aiming at the old goal. A quick shot during the initial aiming window is allowed; later attempts require tracking the shift. Club is a useful starting point, but automated completion is not proof of human difficulty balance.

A common USB SNES preset and per-player calibration are described in [CONTROLLERS.md](CONTROLLERS.md). Controller profiles apply to every mode, not just GOALPOSTS.

## Authoritative geometry

`modes/goalposts.mjs` owns the stage state and `goalGeometry(state,end,numerator,denominator)` contract: centre, width, left/right posts, 36-pixel height, goal plane, centre limits and stage. Physics, keeper alignment, AI shooting and the uncached goal renderer consume this contract. Normal mode receives its original centred geometry without new state/config fields, except the declared version number.

Motion uses the **active simulation clock**, independent of wall time and render frames. Each segment has a 120-tick warning/hold, then 300/240/180 movement ticks at Club/Pro/Elite. Centre endpoints repeat centre → 130 pixels right → 130 pixels left → centre. Width endpoints repeat 180 → minimum → 180 → 180. Integer Q12 smoothstep interpolation produces Q8 centre/width values; half-width post coordinates may be half a Q8 unit. Maximum centre speed is below three pixels per tick, width change below one. There is no trigonometry or extra RNG in geometry. The two-second notice names the direction and narrowing/widening before it happens.

For a swept ball crossing, the crossing numerator and denominator are signed y-distances for that physics tick. Goal geometry interpolates between the previous and current active-clock endpoints, clamping the fraction to [0,1] and truncating each Q8 delta toward zero. Frame collision resolves before scoring using the existing eight-pixel post/five-pixel crossbar regions. A former goal location has no scoring authority. The keeper sees present geometry at its normal decision interval, not a future endpoint. Geometry does not move when the simulation is halted.

Moving posts, crossbar, net and goal target are drawn outside the cached stadium layer; no old goal is left behind. Actual goal motion remains in minimal/reduced-motion mode. Within this mode, the existing camera fits both the moving opening and ball, zooming out when defending far away; this is an isolated visibility guard, not a redesign of normal cameras.

## Replays, regression and verification

Replay **v5** rejects v1–v4; there is no relabeling or migration. Normal seed-731/rain/4,000-input fixture: **`541d73f5`**, 13 checkpoints. Only its version metadata changed from v4. Twelve 4,000-input paired runs across both grounds, three difficulties and seeds 42/731 match merged Phase 3 at every checkpoint after normalizing **only** `version` to 4. See `normal-before.json` and `normal-after.json` in [evidence](evidence/goalposts/).

`tests/goalposts_report.mjs` completes all stages using ordinary movement/charge/curve inputs and verifies the complete replays, at seeds **731 and 42**, all three difficulties. Seed-731 final hashes: Club **`c5a03750`** (1,087 ticks), Pro **`fa343d42`** (1,088), Elite **`f29f2fc2`** (1,079). Each has three 300-tick checkpoints and three real goals, for four points. Early windows are deliberately beatable; these authored routes are reproducibility checks, not human playtesting.

Native tests cover current/old mouth scoring, swept shift contact, both-end frame precedence and high misses, geometry/speed bounds, keeper targets, stopped clocks, progression/failure, best validation, competition isolation, render immutability and controller profiles. Browser tests use actual keys and virtual Gamepad API inputs to complete stages, export/import/worker-verify/play back the whole run, test failure/retry, local persistence and offline reload beneath the repository subpath. Exact executed results and source SHA are recorded with the final PR/evidence; do not infer a browser pass from native tests.

The small original procedural GOALPOSTS theme has deterministic 32-bar trace hash `cd8a4a4e` (seed 1988). Shift, rule revision, near miss and win have new bounded recipes. Existing five themes and the integer reference PCM hash `7787ba01` are unchanged. Audio remains cosmetic and uses separate RNGs.

## Owner acceptance and limits

**Manual gameplay/listening, a physical USB SNES adapter, Safari/WebKit and laptop/GPU profiling: NOT RUN.** The mode is outdoor/solo only; no moving indoor walls, multiplayer challenge, stage-select skips or endless loop. Bests are local to this browser. Unusual adapters using encoded hat axes may need a browser/OS mapping; calibration supports separate directional axes and direction buttons.

1. In Chrome, plug in the generic SNES controller and press a button. Open Settings → Controller Test & Calibration; choose SNES USB (common), inspect each physical button and D-pad direction, and remap any mismatch. Reload to confirm the profile persists. Test simultaneous two-player input in a normal local match.
2. Start GOALPOSTS at Club. Observe a complete warning/shift cycle, shoot at the current opening, deliberately miss at the old position, and try a near-post shot. Score and use Next stage. Confirm the resizing goal stays practical and every rule is visible before play.
3. In stage three, compare an ordinary goal with a shot curved at release, including a keeper parry. Complete the run; export and replay it. Try timeout/two concessions, retry and return home. Check an existing cup save remains intact.
4. Pause with Start during charge, disconnect/reconnect, and navigate pause/results by D-pad and confirm. Check wide/close/pixel modes, rain, a narrow screen and reduced motion. Listen for warning/goal/victory levels and clicks; replay and reload offline.

Use the existing [manual football checklist](MANUAL-QA.md) for normal-mode regressions. PR workflows cannot deploy; production remains gated on verified main after owner merge.
