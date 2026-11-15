# The touchline manual

**Controller profiles:** Settings → Controller Test & Calibration offers a common USB SNES layout, live D-pad/buttons/axes and local per-player remapping. [Setup guide](CONTROLLERS.md).

**GOALPOSTS:** Select it in the clubhouse; ordinary controls apply. Follow the visible shift warning, score through the gold opening, and use Next stage after clearing an objective. [Rules and aiming guide](GOALPOSTS.md).

## Start quickly

Choose a team and ground, then **LET’S PLAY**. P1 is the first/left-hand team on the scoreboard. The P1 marker and yellow ring identify your selected player; P2 uses a blue ring. At each kickoff the banner and minimap tell P1's attacking direction. Teams switch ends at halftime.

| Action | P1 | P2 |
| --- | --- | --- |
| Move | W A S D | Arrow keys |
| Kick / tackle | Space | Enter |
| Pass | F | Right Shift |
| Chip | R | Right Ctrl |
| Switch | Tab | Backslash |
| Curve | Q / E | [ / ] |
| Pause | Escape / P | Escape / P |

Settings allows every player-specific binding to be changed. Reserved pause keys and duplicate assignments are rejected. The help dialog shows the current mappings. The brief default hint bar shows standard mappings; consult the help/settings table if you remap them.

Gamepad: left stick/D-pad moves, A kicks, X passes, B chips, Y switches, shoulders curve, Start pauses. Pad order follows the connected controller enumeration: first pad = P1; second = P2. Either player may use their keyboard at the same time. Disconnecting a pad pauses; check reassigned slots before resuming. Standard-mapped controllers are expected.

## Play with one button

Tap kick for fewer than 12 simulation ticks (0.2 seconds) to pass. Hold for up to 60 ticks, then release to shoot; the bar beneath your player shows power. Aiming follows the movement direction on the release tick, or your last direction when stationary. Near an opponent holding a ground ball (within 42 pixels), pressing kick starts a sliding tackle. Release before kicking again; the tackle cannot turn into a shot after possession changes. A mistimed slide has a cooldown, so defend with movement first.

## Add technique

- **Short pass:** tap kick or use the dedicated pass button. Teammates are chosen by direction, forward progress, distance, available space and passing-lane obstruction.
- **Long pass:** hold kick to charge, then press pass before releasing. Beyond 42 charge ticks the pass is lofted. Release kick afterwards. A dedicated pass/chip consumes the held kick, so its release will not issue a second action.
- **Chip:** use the chip button. Hold kick first for more loft, then chip.
- **Banana shot:** apply a curve key at release. Steer with left/right or the curve keys while the ball is in flight. Settings adjusts aftertouch from off to wild; base curve at release remains available.
- **Volley:** press pass or release a charged kick when an airborne ball is within reach. The ball must physically be within 30 pixels and below the aerial-contact limit.
- **Overhead:** meet an airborne ball while moving away from the opposition goal and kick. The overhead attempt targets the opponent's goal rather than your backwards movement.
- **Switch:** chooses the next nearest eligible outfielder. Automatic selection follows a teammate in possession and can select a closer defender; switch to manual-only in Settings if you prefer.

## Rules and modes

Outdoor is 11-a-side. The last touch determines throw-ins, corners and goal kicks. Restarts are automatic after a short pause, giving the selected player the next touch. There is no offside, foul, card, injury, substitution or penalty system.

Indoor is six-a-side with faster movement, a smaller pitch and rebounding walls. Rain is an outdoor condition: it reduces traction, occasionally causes a seeded slip and lets a rolling ball travel farther.

Matches have two equal active-play halves. Restarts, halftime and goal replays stop the match clock. Quick and local matches can draw. Cup and Challenge ties continue until a golden goal decides them. Cup has three rounds; Challenge has seven opponents with increasing difficulty. A defeat ends your run. Progress saves after each completed round, so leaving an unfinished match lets you replay that round later.

## Practice / Skills

Choose **Practice / Skills** from the clubhouse, pick any of six drills and press Start. Your current ground is used. The drills cover movement/first touch, three completed passes, charged goals, a curved goal from a wide position, tackling and keeper awareness. They use real controls and ball physics with authored starting positions. Instructions reflect your keyboard remapping; standard gamepad inputs also work.

A successful drill pauses with Next skill and Retry actions. You can pause at any time to retry, skip or leave. Practice does not advance your cup, alter normal match statistics or create an exportable match replay. A caught keeper ball is protected until distribution; aim around the keeper, not through their hands.

Short action taps between simulation ticks are retained for one input sample. A first-time pass/shot can wait up to six ticks for a nearby ball (within 60 pixels), but still needs physical kicking reach. Resuming after a pause cancels an unfinished charge instead of firing it. Switching players cancels the old charge; losing possession cancels release through another carrier. The on-pitch readout distinguishes TAP PASS, SHOT and consumed/tackle gestures.

## View and feedback

Settings offers Follow, Wide tactical and Close cameras; Clean, CRT, Mint and Low-resolution pixel styles; and Minimal effects. The system reduced-motion preference also limits camera easing, stride bob and trails. Ball/player movement remains visible because it is essential to play. The scoreboard sits above the pitch, possession is shown beneath it, and action feedback identifies shots, parries and frame hits. Sprint animation reflects speed; there is no extra sprint button.

## Replays, sound and offline use

Pause or finish a match to export its replay JSON. Open **Replay studio**, import the file and wait for verification. A matching hash enables playback. This works for partial as well as complete v4 recordings. Earlier v1/v2/v3 files are rejected because the simulation changed. A goal automatically triggers a slower visual replay of recent recorded states.

Audio requires a click or kickoff to satisfy browser autoplay rules. Menu, outdoor, indoor, goal and victory have separate original themes. Adjust master, music and effects volumes independently; pausing suspends audio, and resuming restarts it. Offline play becomes available after successful asset caching, indicated in the footer. Installation is optional; an offline browser reload also works after caching. Close old tabs and reopen after an update to activate the new cached release.
