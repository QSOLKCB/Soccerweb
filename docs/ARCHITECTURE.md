# GOALPOSTS / controller extension

`modes/goalposts.mjs` supplies the shared moving goal geometry and fixed-step challenge lifecycle. State initialization is opt-in through `config.mode === 'goalposts'`; static matches have no mode fields. Physics interpolates previous/current geometry at swept crossing time, resolving the frame first. AI and uncached goal rendering consume the same contract. Stage advancement is a recorded fire input, so full-run replays reproduce it. Mode-specific camera fitting is cosmetic. See [GOALPOSTS.md](GOALPOSTS.md) for exact bounds/rounding and v5 compatibility.

`input/gamepads.mjs` validates and normalizes per-player controller profiles. `Controls` combines the resulting logical input with keyboard controls; controller IDs/button indices never enter authoritative state or replays. Host-only calibration and menu focus run from the animation loop. Logical action presses, gesture cancellation and the fixed simulation loop retain their existing boundary. Local controller profiles and GOALPOSTS bests have separate bounded schemas/keys.

---

# Architecture and reproducibility

## Runtime boundaries

| Module | Responsibility |
| --- | --- |
| `game/state.mjs`, `game/match.mjs` | Seeded match state, formations, player movement, clocks, phases, selection and rules |
| `simulation/math.mjs`, `simulation/physics.mjs` | Integer arithmetic, PRNG, free-ball impulses/collisions, kicks, goals and restarts |
| `ai/team.mjs` | Positional shape, nearest chaser, support runs, pass utility, shooting, tackling and keeper decisions |
| `input/controls.mjs` | Independent keyboard maps and Gamepad API input; focus/disconnect handling |
| `render/canvas.mjs`, `render/players.mjs`, `render/stadium.mjs`, `render/camera.mjs` | Cached stadium layer, articulated poses, ball-last depth order, cosmetic camera/interpolation and adjustable effects |
| `audio/score.mjs`, `audio/effects.mjs`, `audio/synth.mjs`, `audio/reference.mjs` | Authored seeded scores, deterministic effect recipes, bounded live synth and separate integer PCM reference |
| `modes/competition.mjs` | Cup/Challenge fixtures, simulated CPU results, persistence helpers |
| `replay/replay.mjs`, `replay/verify-worker.mjs` | Normalized tick input, serialisation, hashes, validation and isolated verification |
| `app.mjs` | Browser host, menus, fixed-step accumulator, settings, goal replay playback and result UI |

The simulation imports no DOM, browser clock, rendering or audio code. `step(state, [p1, p2])` is the sole match-state advance. The renderer receives snapshots and may interpolate and sort a copied player array; it cannot influence outcomes. AI and pairwise player separation use stable player ID order. Eligible ball contacts use nearest distance, then player ID for ties; the first successful contact ends that contact pass. Audio events leave the simulation through an ephemeral `events` array and never feed back.

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

## Input and replay format v5

Version 5 adds opt-in GOALPOSTS configuration, geometry clocks, stage state and recorded stage advancement. Normal football preserves the Version 4 action gestures, first-time buffering, receiving, keeper protection and indoor AI decisions. Player fire-mode/pending-action fields remain authoritative. Versions 1–4 are explicitly rejected; no migration or silently changed resimulation is attempted. Version 2 previously corrected goal-frame scoring precedence; that correction is preserved.

One frame contains two arrays: `[horizontal, vertical, buttons, curve]`. Axes and curve are integers in -1..1. Button bits: kick=1, pass=2, chip=4, switch=8, cancel gesture=16. Resume after an overlay emits one cancel bit on the next active tick, recorded like other input; pause itself never mutates authoritative state. Entries are indexed by tick; there is no wall-clock timestamp. Input arrays include both teams even when one is AI-controlled. AI is rerun, not recorded as canned positions.

Exported JSON includes `format`, `version`, normalized `config`, `frames`, `[tick, hash]` checkpoints every 300 ticks and `finalHash`. The state hash is 32-bit FNV-1a over a stable JSON representation excluding transient audio/UI events. It is an engineering drift detector, **not a cryptographic integrity or anti-cheat mechanism**. Do not compare replays across changed simulation versions.

Imports are limited to 12 MB in the UI and 120,000 frames by the verifier. Schema, settings, frame values, checkpoint order and final state are validated. Verification runs in a dedicated module Worker. The playback host resimulates inputs; it never treats imported player positions as authoritative. Goal replays are separate, bounded in-memory visual snapshots sampled every three ticks, shown at 20 samples per second for slow motion. They do not alter the saved replay.

## AI and match flow

Outfield shape uses formations, goal-side marking, support triangles and teammate separation. A friendly carrier receives support rather than another chaser at their feet. Intended receivers chase free passes. Pass utility penalizes obstructed lanes using pixel-quantized segment distances; short passes lead the receiver and scale speed by distance. Carriers settle for at least eight ticks before shooting and fourteen before passing; shots aim away from the keeper with seeded difficulty-dependent error.

Difficulty changes reaction intervals, interception anticipation, shot error and marking, preserving running speed and keeper reach. Keepers predict goal-plane intersections, dive on incoming threats and hold catches before distribution. Hard shots usually rebound; a close diving contact may catch one. A caught ball is protected from other players until distribution, with a short spring target near the keeper rather than the ordinary leading-foot dribble. Passive steals require the defender to be at least three pixels closer than the carrier. First touches dissipate incoming velocity without snapping ball position. Indoor keeper reaction intervals are 7/6/5 ticks at Club/Pro/Elite; reach/speed stay unchanged. Two indoor defenders remain behind possession, and carriers settle for 16 ticks before shot decisions / 18 before pass decisions. Saves count shot/chip/overhead contacts, not ordinary passes.

Human dry acceleration is 62 Q8 units/tick (was 58), with stronger dry braking and turning; wet acceleration/braking remain lower. Top speeds remain 790 outdoor / 900 indoor. Shot direction reads the current release tick. Aerial kick input no longer initiates an unreachable ground slide. Physical spring dribbling, charge thresholds, aftertouch, switching and arcade rules remain intact. Indoor drag is 252/256 and wall restitution 224/256, separately from outdoor conditions.

State phases: `kickoff → play → goal/restart/halftime/fulltime`. Half time switches attacking ends. Knockout draws enter golden-goal play. No random winner is awarded. Asynchronous cup-fixture completion captures a match-run ID. Leaving the match or entering another invalidates that ID; stale successes and errors cannot update competition state, localStorage, or result controls. Other cup games run AI vs AI in this exact simulation, with bounded execution and an explicit retry error on a fixture exceeding 120,000 ticks.

## Procedural audio

Six original 32-bar themes (menu/outdoor/indoor/goal/victory/goalposts) use intro, verse, lift and turnaround sections. Explicit bass, lead, harmony, kick/snare/hat/clap and indoor arpeggio events have seeded fills and a stable tie order. Pure SFX recipes vary envelopes, noise, pitch sweeps and FM with event type and impact speed, using their own seed.

The live Web Audio graph uses separate music/SFX buses, stereo panning, shaped gain ramps and a compressor before master gain. Scheduling uses tick buckets, a 120 ms lookahead, a 16-tick catch-up bound and at most 64 simultaneous voice groups; ended sources disconnect. Theme changes release existing music voices. Serialized suspend/resume transitions follow pause and tab visibility. Audio starts after a browser interaction. Actual speaker output remains browser/device dependent and is never authoritative.

`referencePCM` is a separate, specified 16 kHz mono signed-16-bit square-wave reference. It uses integer millihertz frequency constants, a 16-bit phase accumulator, integer envelopes and saturation. It tests reproducible PCM for the musical event sequence; it is **not** a bit-exact rendering of the complete Web Audio mix, noise, effects or device output.

## Action and practice isolation

`game/actions.mjs` gives each kick press a context: kick, tackle or consumed. A dedicated pass/chip consumes a held kick until release; a tackle cannot become a charged shot. A nearby unavailable ball can queue one first-time action for at most six ticks, canceled on a new gesture, selection loss, another carrier, stopped play or the recorded resume-cancel input. Input taps shorter than one tick are sampled once by `Controls` and recorded as ordinary tick inputs. Keyboard/gamepad both feed the same action logic.

`modes/practice.mjs` authors six isolated setups. Its `training` state flag freezes unused actors, while human movement, active keeper decisions, contacts, goals and passes run through `step`. A host-only observer tracks real outcomes and pauses on completion. Practice has no Recorder, no competition attachment and no persistence writes. Starting it increments the existing match-run ID, invalidating any pending prior fixture completion. Normal states never contain `training`.

## Rendering budget and accessibility

The renderer caches the static full-field stadium layer by dimensions/weather/palette, reuses its depth-order array and bounded eight-point ball trail, and renders only cosmetic state. The ball is drawn after players. Follow/wide/close camera views use velocity anticipation, time-based smoothing and a visibility guard for ball height. The score/clock is outside the canvas. Selected-player rings, possession labels, charge feedback and the minimap remain visible.

Backing resolution is capped at DPR 2; optional pixel mode uses a 0.65 backing ratio. Minimal effects and `prefers-reduced-motion` suppress trails, stride bob and camera easing; essential football motion remains. Renderer invariants assert snapshots/hashes are unchanged. CI RAF timings are recorded, but are not a laptop GPU profile.

## Storage, security and deployment

Only preferences and competition progress enter localStorage. Large replays are explicit file exports. No user data leaves the browser. App assets resolve relative to the repository root; there is no CDN dependency. The worker cache name includes its complete app scope so another app on the same origin is not evicted. A waiting worker activates after older app tabs close. Keep cache version bumps synchronized with runtime edits.

PR checks have read-only repository permissions. The separate default-branch-only deploy job receives `pages: write` and `id-token: write`, and uses the `github-pages` environment. Existing repository permissions and email privacy protection are preserved. No branch protection or Pages setting is changed by this implementation.
