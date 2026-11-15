# Architecture and reproducibility

## Runtime boundaries

| Module | Responsibility |
| --- | --- |
| `game/state.mjs`, `game/match.mjs` | Seeded match state, formations, player movement, clocks, phases, selection and rules |
| `simulation/math.mjs`, `simulation/physics.mjs` | Integer arithmetic, PRNG, free-ball impulses/collisions, kicks, goals and restarts |
| `ai/team.mjs` | Positional shape, nearest chaser, support runs, pass utility, shooting, tackling and keeper decisions |
| `input/controls.mjs` | Independent keyboard maps and Gamepad API input; focus/disconnect handling |
| `render/canvas.mjs` | Procedural sprites/stadium, depth order, scrolling camera, interpolation and optional visual effects |
| `audio/synth.mjs` | Seeded musical event generation, oscillator/noise playback, integer reference PCM |
| `modes/competition.mjs` | Cup/Challenge fixtures, simulated CPU results, persistence helpers |
| `replay/replay.mjs`, `replay/verify-worker.mjs` | Normalized tick input, serialisation, hashes, validation and isolated verification |
| `app.mjs` | Browser host, menus, fixed-step accumulator, settings, goal replay playback and result UI |

The simulation imports no DOM, browser clock, rendering or audio code. `step(state, [p1, p2])` is the sole match-state advance. The renderer receives snapshots and may interpolate and sort a copied player array; it cannot influence outcomes. AI, ball contacts and pairwise player separation use stable player ID order. Audio events leave the simulation through an ephemeral `events` array and never feed back.

## Tick and arithmetic contract

- Exactly 60 simulation ticks represent one second of active play. Match elapsed time advances only in `play`; a separate tick counter also includes restart countdowns.
- Coordinates, velocities and height use **Q8 fixed point**: one pitch pixel = 256 units. Outdoor pitch: 720 × 1120 pixels; indoor: 540 × 800. Facing vectors use the same scale.
- Intermediate numeric products use exact integer-valued JavaScript Numbers within 2^53. Current field coordinates are below 300,000 units; distance squares stay below 2 × 10^11. Normalized velocity products remain far below 2^53. No authoritative arithmetic intentionally wraps, except the explicitly uint32 PRNG and hash.
- Multiplication/division helpers use `Math.trunc`, i.e. rounding toward zero. `isqrt` uses integer Newton iteration and floors a nonnegative square root. Movement directions are scaled before normalization, preventing the small-vector diagonal-speed error.
- Frame rendering uses floating-point interpolation/trigonometry, but writes no state. Pass utility uses ordinary bounded IEEE-754 arithmetic, with no transcendental functions or nondeterministic operations. Initial formation fractions are converted to integer coordinates once. This is not a universal all-integer implementation; the authoritative kinematics and state are integer-valued.
- Xorshift32 has an explicit unsigned seed (zero normalizes to 1988). The simulation owns its RNG state; music and reference PCM never consume it.
- Ball drag, spin rotation, spring dribbling, gravity, bouncing, tackling and collisions are applied in a specified fixed order. Dribbling changes ball velocity toward a leading-foot target; possession does not teleport the ball. A swept goal-plane test evaluates interpolated crossing position and height. Post/crossbar contacts resolve before goals, including the inner frame regions that overlap the goal opening. Set pieces intentionally reposition the ball/player during stopped play.
- Rendering cadence affects how quickly a slow machine catches up, not the result of an identical tick-indexed stream. The host caps a single accumulated wall-time delta at 100 ms; sustained overload slows game time rather than simulating an unbounded backlog. Hidden tabs/focus loss pause the game.
- Pause and cinematic replay are host states: they do not call `step` or append replay inputs. No elapsed simulation time is silently consumed. The player may resume after a focus-loss pause. Overlay screens release gameplay key interception and clear held inputs; paused matches retain Escape/P and gamepad Start shortcuts. Results focus an enabled action so Tab/Enter/Space work without a mouse. Controller disconnection clears keyboard state and requests pause; the currently connected pads are reassigned by enumerated slot.

The reproducibility promise is **same release/version + normalized config/seed + the same tick-indexed input = the same final authoritative state**. Regression tests and browser re-import test this promise. Cross-browser CPU/audio bit identity is not claimed without cross-browser evidence. Changing numerical rules requires a replay format/version migration or explicit incompatibility; preserve fixtures before doing so.

## Input and replay format v2

Version 2 changes frame-hit scoring precedence. Version 1 files are explicitly rejected because their scores and knockout results can differ; they are not silently replayed under the new rules.

One frame contains two arrays: `[horizontal, vertical, buttons, curve]`. Axes and curve are integers in -1..1. Button bits: kick=1, pass=2, chip=4, switch=8. Entries are indexed by tick; there is no wall-clock timestamp. Input arrays include both teams even when one is AI-controlled. AI is rerun, not recorded as canned positions.

Exported JSON includes `format`, `version`, normalized `config`, `frames`, `[tick, hash]` checkpoints every 300 ticks and `finalHash`. The state hash is 32-bit FNV-1a over a stable JSON representation excluding transient audio/UI events. It is an engineering drift detector, **not a cryptographic integrity or anti-cheat mechanism**. Do not compare replays across changed simulation versions.

Imports are limited to 12 MB in the UI and 120,000 frames by the verifier. Schema, settings, frame values, checkpoint order and final state are validated. Verification runs in a dedicated module Worker. The playback host resimulates inputs; it never treats imported player positions as authoritative. Goal replays are separate, bounded in-memory visual snapshots sampled every three ticks, shown at 20 samples per second for slow motion. They do not alter the saved replay.

## AI and match flow

Outfield shape uses the stored formation and a ball-relative shift. One player chases the predicted ball location while others defend or support. A carrier chooses a forward run, pressured pass or a shot using distance, space and club tactics. Difficulty changes reaction intervals, interception anticipation, shot error and positional shifts; it does not secretly raise outfielder top speed. Keepers track predicted horizontal ball position, dive under threat, catch slower shots or rebound powerful ones.

State phases: `kickoff → play → goal/restart/halftime/fulltime`. Half time switches attacking ends. Knockout draws enter golden-goal play. No random winner is awarded. Asynchronous cup-fixture completion captures a match-run ID. Leaving the match or entering another invalidates that ID; stale successes and errors cannot update competition state, localStorage, or result controls. Other cup games run AI vs AI in this exact simulation, with bounded execution and an explicit retry error on a fixture exceeding 120,000 ticks.

## Procedural audio

A seeded event sequencer creates original pitch/rhythm events on a tick grid. Web Audio schedules square, triangle and sine oscillators with envelopes and pitch sweeps, plus seeded filtered noise for crowd, weather and contact. Audio starts after a browser interaction; master, music and SFX gains are separate. Sound scheduling and actual speaker output are inherently browser/device dependent and are not authoritative.

`referencePCM` is a separate, specified 16 kHz mono signed-16-bit square-wave reference. It uses integer millihertz frequency constants, a 16-bit phase accumulator, integer envelopes and saturation. It tests reproducible PCM for the musical event sequence; it is **not** a bit-exact rendering of the complete Web Audio mix, noise, effects or device output.

## Storage, security and deployment

Only preferences and competition progress enter localStorage. Large replays are explicit file exports. No user data leaves the browser. App assets resolve relative to the repository root; there is no CDN dependency. The worker cache name includes its complete app scope so another app on the same origin is not evicted. A waiting worker activates after older app tabs close. Keep cache version bumps synchronized with runtime edits.

PR checks have read-only repository permissions. The separate default-branch-only deploy job receives `pages: write` and `id-token: write`, and uses the `github-pages` environment. Existing repository permissions and email privacy protection are preserved. No branch protection or Pages setting is changed by this implementation.
