# The touchline manual

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

Tap kick for fewer than 12 simulation ticks (0.2 seconds) to pass. Hold for up to 60 ticks, then release to shoot; the bar beneath your player shows power. Aiming follows the direction you last ran. Without possession, pressing kick starts a sliding tackle. A mistimed slide has a cooldown, so defend with movement first.

## Add technique

- **Short pass:** tap kick or use the dedicated pass button. Teammates are chosen by direction, forward progress, distance and available space.
- **Long pass:** hold kick to charge, then press pass before releasing. Beyond 42 charge ticks the pass is lofted. Release kick afterwards.
- **Chip:** use the chip button. Hold kick first for more loft, then chip.
- **Banana shot:** apply a curve key at release. Steer with left/right or the curve keys while the ball is in flight. Settings adjusts aftertouch from off to wild; base curve at release remains available.
- **Volley:** press pass or release a charged kick when an airborne ball is within reach. The ball must physically be within 30 pixels and below the aerial-contact limit.
- **Overhead:** meet an airborne ball while moving away from the opposition goal and kick. The overhead attempt targets the opponent's goal rather than your backwards movement.
- **Switch:** chooses the next nearest eligible outfielder. Automatic selection follows a teammate in possession and can select a closer defender; switch to manual-only in Settings if you prefer.

## Rules and modes

Outdoor is 11-a-side. The last touch determines throw-ins, corners and goal kicks. Restarts are automatic after a short pause, giving the selected player the next touch. There is no offside, foul, card, injury, substitution or penalty system.

Indoor is six-a-side with faster movement, a smaller pitch and rebounding walls. Rain is an outdoor condition: it reduces traction, occasionally causes a seeded slip and lets a rolling ball travel farther.

Matches have two equal active-play halves. Restarts, halftime and goal replays stop the match clock. Quick and local matches can draw. Cup and Challenge ties continue until a golden goal decides them. Cup has three rounds; Challenge has seven opponents with increasing difficulty. A defeat ends your run. Progress saves after each completed round, so leaving an unfinished match lets you replay that round later.

## Replays, sound and offline use

Pause or finish a match to export its replay JSON. Open **Replay studio**, import the file and wait for verification. A matching hash enables playback. This works for partial as well as complete recordings. A goal automatically triggers a slower visual replay of recent recorded states.

Audio requires a click or kickoff to satisfy browser autoplay rules. Adjust master, music and effects volumes independently. Offline play becomes available after successful asset caching, indicated in the footer. Installation is optional; an offline browser reload also works after caching. Close old tabs and reopen after an update to activate the new cached release.
