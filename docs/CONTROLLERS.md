# USB SNES controllers in Chrome

Plug the controller in, open the game and press a button so Chrome exposes it. Open **Settings → Controller Test & Calibration**, select Player 1 or Player 2, and choose **SNES USB (common)**. Generic adapters vary: the preset is a starting layout, not hardware auto-detection.

| Physical SNES control | Action | Common preset button index |
| --- | --- | --- |
| B (bottom) | Tap pass / hold-release shot / tackle; menu confirm | 1 |
| Y (left) | Dedicated pass | 0 |
| A (right) | Chip; menu back | 2 |
| X (top) | Switch player | 3 |
| L / R | Curve left / right | 4 / 5 |
| Select | Alternate player switch | 8 |
| Start | Pause / resume; advance a cleared GOALPOSTS stage | 9 |
| D-pad | Move; up/down menu focus, left/right option adjustment | Axes 0/1, or buttons 12–15 |

The standard Gamepad API layout remains the default. Controllers Chrome maps to `standard` may work best with that layout even if the shell looks like a SNES pad.

The test screen shows the connected device name, live raw button numbers, all axes, logical D-pad direction and mapped actions. Select an action row, release all buttons, then press the physical button to assign. A conflicting assignment swaps with the old button, keeping essential actions reachable. Cancel is available. Test-screen input cannot accidentally activate menus or start a match; use mouse or keyboard to assign/close it.

For an adapter whose D-pad appears as buttons, select **Direction buttons only** and assign Up/Down/Left/Right. For separate axes, select **Axes + direction buttons** and choose its horizontal/vertical axis indices from the live readout. The dead zone ignores small axis noise. Encoded single hat axes are not decoded by this initial profile; use an OS/browser mapping for those devices.

Profiles are saved independently for two players in local storage (`soccerweb.controllers.v1`) and apply to Quick Match, local two-player, Cup, Challenge, Practice and GOALPOSTS. They do not alter keyboard mappings, football saves or replays. A replay records the resulting logical input, not device-specific button IDs. Connection order chooses the player slot; disconnect pauses the match, so check the slot before resuming.

In menus, tap the D-pad to move focus; left/right adjusts a focused select or volume slider. Kick confirms; chip closes a dialog or resumes from pause. Held confirm is suppressed when entering gameplay so it cannot become an unintended charged shot. Keyboard and mouse remain available throughout.

Automated tests use virtual adapters through the real browser Gamepad API boundary. **Physical generic USB SNES hardware testing: NOT RUN.** Use the live display to verify your particular adapter in Chrome.
