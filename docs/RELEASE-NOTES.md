# SOCCERWEB 3.1 — GOALPOSTS and USB SNES controls

- Optional outdoor 5 v 5, three-stage GOALPOSTS challenge: moving/resizing goals, announced rules, authentic scoring, finite timers/concession limits, victory/failure, retry and complete replay support. Physics, renderer and keepers share the same authoritative opening. Normal football retains its Phase 3 rules.
- Separate local best times; no cup, practice or preference mutations. Optional fictional dedication without implied endorsement.
- Generic USB SNES preset, dedicated live Controller Test & Calibration screen, per-player local remapping, directional axes/buttons and controller menu navigation. Standard mappings and keyboard remapping remain available.
- Original procedural mode theme and shift/revision/near-miss/win cues; reduced-motion keeps gameplay-critical posts visible. New modules are precached, with a coherent cache version.
- Replay v5 deliberately rejects v1–v4. Normal 4,000-tick fixture `541d73f5`; normalized gameplay/checkpoints match Phase 3. See [GOALPOSTS](GOALPOSTS.md) and [controller guide](CONTROLLERS.md) for exact fixtures, limits and owner checks.

Physical controller and human gameplay/listening QA remain **NOT RUN**. This is an unmerged review candidate; PR checks cannot deploy.

---

# SOCCERWEB 3.0.0 — The Matchday Experience

Focused playability improvements on merged PR #3. The native buildless runtime, original procedural assets, offline/subpath behavior and main-only Pages deployment contract remain intact.

- One kick press has one purpose: quick pass, charge/release or nearby tackle. Dedicated pass/chip consumes a held kick; changing selection or losing the ball cancels unsafe release. Keyboard/gamepad resume sends a recorded cancel input instead of releasing an old charge. Very short action taps survive until the next input sample. A bounded six-tick first-time window still requires physical reach.
- Keeper catches are protected until distribution, fixing alternating keeper/attacker possession loops. First touch dissipates incoming velocity; passive steals require a genuinely closer defender. No new scoring shortcuts, teleporting control or hidden speed/reach boosts.
- Indoor keepers respond earlier, two defenders retain cover, and carriers settle before decisions. The paired 96-fixture sweep reduced indoor short spells from 75.9% to 57.7% and five-goal margins from seven fixtures to three. Outdoor/individual-difficulty regressions and Club indoor outliers remain documented.
- Six interactive Practice / Skills drills: movement, three passes, charge/release, a curved goal, tackling and keeper awareness. Real controls/physics, remapping-aware instructions, retry/next controls, isolated statistics and no cup/replay writes.
- Clearer charge/consumed-action, pass receipt, tackle/interception and goal-replay score feedback. Quiet contextual SFX; browser-compatible envelope release and gesture-time audio resume.
- Expanded Chromium/Firefox automation, sustained input routes, virtual gamepads, captured live Web Audio, and separate simulation/snapshot/render CPU measurements. Test tools are not shipped.

Replay **v4** deliberately rejects v1/v2/v3; no migration. Seed 731 / 4,000 ticks / 13 checkpoints: **`c3d201a0`**. The deterministic music/reference DSP fixture remains **`7787ba01`**. Preferences and between-round competition history keep their schema. All new runtime modules are precached with a new service-worker version.

See [Phase 3 evidence](PHASE-3.md), [verification](VERIFICATION.md) and the [owner acceptance script](MANUAL-QA.md). Human playtesting/listening, physical controllers, Safari/WebKit and ordinary-laptop profiling were **NOT RUN**. The automated results do not prove enjoyable difficulty or full acceptance. Existing arcade-rule, touch, online-play and replay-seeking limitations remain. Keep this PR unmerged for owner review.

---

# SOCCERWEB 2.0.0 — The Beautiful Game

Phase 2 builds on merged PR #1. Native HTML/CSS/modules, Canvas 2D, Web Audio, offline play and the fixed 60 Hz Q8 simulation remain the runtime foundation. All artwork, identities, melodies and effects are original procedural content.

## Live-match changes

- Articulated footballers with readable kits, heads, limbs, boots, keeper gloves and observed idle/run/turn/sprint/windup/kick/pass/slide/fall/dive/catch/celebration poses. Rotation, elevation, shadows and bounded trails make the ball easier to track; it draws after players.
- Textured grass, wet surfaces, goals/nets, stands, crowd reactions and lighting. Indoor has its own enclosed court, boards and glass. Follow/wide/close cameras, a scoreboard above the pitch, possession/action feedback, low-resolution pixels, high-DPI backing and reduced-motion/minimal effects.
- More responsive dry braking/turning and current-tick shot aiming; aerial contact no longer accidentally starts a ground slide. Pass selection considers lanes, leads recipients and scales pass speed. Physical dribbling, charge/curve/chip/volley controls, switching and top speeds are preserved.
- Support triangles, goal-side marking, teammate separation, deliberate pass/shot decisions and reactive keepers. Nearest eligible contact wins, with stable ID tie-breaking. Indoor rebounds lose slightly more energy. Save statistics now exclude ordinary passes.
- Five original structured 32-bar themes with rhythm/bass/lead/harmony, seeded variations, FM and shaped envelopes. Impact-sensitive SFX, separate mix buses, bounded voice scheduling and serialized pause/resume. Deterministic score/SFX traces and reference WAVs are CI artifacts.

## Compatibility and preserved review fixes

Replay **v3** explicitly rejects v1/v2 recordings: authoritative AI, response, pass/contact and indoor rules changed. The 4,000-tick seed-731 regression hash is `7f1ba5f7` (13 checkpoints). There is no backward replay migration. Settings and between-round competition saves retain their existing schema; subsequent fixtures use the new simulation.

The integer reference PCM algorithm is unchanged. Its two-second hash changes from `789c1fd6` to **`7787ba01`** because the authored score events changed. This reference is not the complete live Web Audio mix.

The prior async fixture/run-ID guard, frame-collision-before-goal precedence and keyboard-accessible pause/results overlays remain covered by regression tests. Service-worker assets/cache are updated. PR checks cannot deploy; production remains gated on verified `main` after owner merge.

## Evidence and limits

[Phase 2 comparison](PHASE-2.md) contains actual before/after match captures, seeded metrics, audio fixtures and CI provenance. [Verification](VERIFICATION.md) lists commands and coverage. All 61 native tests pass; the real Chromium workflow covers both grounds, P2, replay, offline, display options and audio state transitions.

This remains a review candidate. The 12-match seeded sweep shows less teammate crowding and more outdoor shots, but indoor brief possessions rise slightly and some indoor scorelines are lopsided. It is not proof of a balanced human difficulty curve. Human playtesting/listening, physical gamepads, Safari/Firefox, mobile installation and ordinary-laptop profiling remain unperformed here. There are no touch controls, offside/fouls/cards/substitutions/penalty shootouts, network play or replay seeking. Golden-goal and bounded CPU-fixture retry behavior remain unchanged. Screen-reader semantics cover menus/status, not spatial Canvas football.

Historical Phase 1 implementation and evidence remain in the merged PR #1 and Git history.
