<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="ansi" />

</a>

<h3 align="center">ANSI escape codes for some terminal swag.</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
npm install @visulima/ansi
```

```sh
yarn add @visulima/ansi
```

```sh
pnpm add @visulima/ansi
```

## Features

- **Comprehensive Cursor Control:** Functions for precise cursor positioning, movement, visibility, and style.
- **Screen Manipulation:** Clear parts of the screen or the entire screen, manage alternative screen buffers, and control scrolling.
- **Text Erasure:** Erase characters, lines, or parts of lines.
- **iTerm2 Integration:** Support for iTerm2 specific features like image display.
- **Terminal Mode Management:** Control various terminal modes like line feed, local echo, and mouse events.
- **Mouse Event Handling:** Enable and disable different types of mouse tracking.
- **Window and Title Control:** Manipulate window titles, icons, and basic window operations (maximize, minimize, etc. for supported terminals).
- **Status Reporting:** Request and report various terminal statuses.
- **Hyperlinks:** Create clickable hyperlinks in the terminal.
- **Utility Functions:** Includes functions to strip ANSI codes and passthrough sequences for tmux.

## Usage

```js
import { cursorUp, cursorLeft } from "@visulima/ansi";

// Moves the cursor two rows up and to the left
process.stdout.write(cursorUp(2) + cursorLeft);
//=> '\u001B[2A\u001B[1000D'
```

or

```js
import { cursorUp, cursorLeft } from "@visulima/ansi/cursor";

// etc, as above...
```

And for commonjs:

```js
const { cursorUp, cursorLeft } = require("@visulima/ansi");

// etc, as above...
```

**More Examples:**

**Cursor Manipulation**

```javascript
import { cursorTo, cursorUp, eraseLine } from "@visulima/ansi";

// Move cursor to column 10, row 5
process.stdout.write(cursorTo(10, 5));

// Move cursor up 3 lines
process.stdout.write(cursorUp(3));

// Erase the current line
process.stdout.write(eraseLine);
```

**Screen Clearing**

```javascript
import { clearScreen, eraseDown } from "@visulima/ansi";

// Clear the entire screen
process.stdout.write(clearScreen);

// Clear from cursor to end of screen
process.stdout.write(eraseDown);
```

**Text Styling (with other libraries)**

While `@visulima/ansi` focuses on terminal control, you can combine it with libraries like `chalk` for text styling:

```javascript
import { cursorTo } from "@visulima/ansi";
import chalk from "chalk";

process.stdout.write(cursorTo(0, 0));
process.stdout.write(chalk.blue("This is a blue message at the top left!"));
```

## API

This package exports the following functions and constants. For a detailed list of all exports, see the `src/index.ts` file.

**General**

- `beep`

**Alternative Screen** (from `alternative-screen.ts`)

- `ALT_SCREEN_OFF`
- `ALT_SCREEN_ON`
- `alternativeScreenOff`
- `alternativeScreenOn`

**Clear** (from `clear.ts`)

- `clearLineAndHomeCursor`
- `clearScreenAndHomeCursor`
- `clearScreenFromTopLeft`
- `resetTerminal`

**Cursor** (from `cursor.ts`)

- `CURSOR_BACKWARD_1`
- `CURSOR_DOWN_1`
- `CURSOR_FORWARD_1`
- `CURSOR_UP_1`
- `cursorBackward`
- `cursorBackwardTab`
- `cursorDown`
- `cursorForward`
- `cursorHide`
- `cursorHorizontalAbsolute`
- `cursorHorizontalForwardTab`
- `cursorLeft`
- `cursorMove`
- `cursorNextLine`
- `cursorPosition`
- `cursorPreviousLine`
- `cursorRestore`
- `cursorSave`
- `cursorShow`
- `cursorTo`
- `cursorToColumn1`
- `cursorUp`
- `cursorVerticalAbsolute`
- `eraseCharacter` (Note: Also related to erase)
- `REQUEST_CURSOR_POSITION`
- `REQUEST_EXTENDED_CURSOR_POSITION`
- `RESTORE_CURSOR_DEC`
- `SAVE_CURSOR_DEC`
- `setCursorStyle`

**Erase** (from `erase.ts`)

- `eraseDisplay`
- `eraseDown`
- `eraseInLine`
- `eraseLine`
- `eraseLineEnd`
- `eraseLines`
- `eraseLineStart`
- `eraseScreen`
- `eraseScreenAndScrollback`
- `eraseUp`

**Hyperlink** (from `hyperlink.ts`)

- `hyperlink`

**Image** (from `image.ts`)

- `image`

**iTerm2 Integration** (from `iterm2.ts` and `iterm2/`)

- `IT2_AUTO`
- `it2Cells`
- `it2Percent`
- `it2Pixels`
- `iTerm2`
- `ITerm2File`
- `ITerm2FileEnd`
- `ITerm2FilePart`
- `ITerm2MultipartFileStart`

**Mode** (from `mode.ts`)

- `BDSM`
- `BiDirectionalSupportMode`
- `createAnsiMode`
- `createDecMode`
- `DECRPM`
- `DECRQM`
- `InsertReplaceMode`
- `IRM`
- `isModeNotRecognized`
- `isModePermanentlyReset`
- `isModePermanentlySet`
- `isModeReset`
- `isModeSet`
- `KAM`
- `KeyboardActionMode`
- `LineFeedNewLineMode`
- `LNM`
- `LocalEchoMode`
- `reportMode`
- `RequestBiDirectionalSupportMode`
- `RequestInsertReplaceMode`
- `RequestKeyboardActionMode`
- `RequestLineFeedNewLineMode`
- `RequestLocalEchoMode`
- `requestMode`
- `RequestSendReceiveMode`
- `ResetBiDirectionalSupportMode`
- `ResetInsertReplaceMode`
- `ResetKeyboardActionMode`
- `ResetLineFeedNewLineMode`
- `ResetLocalEchoMode`
- `resetMode`
- `ResetSendReceiveMode`
- `RM`
- `SendReceiveMode`
- `SetBiDirectionalSupportMode`
- `SetInsertReplaceMode`
- `SetKeyboardActionMode`
- `SetLineFeedNewLineMode`
- `SetLocalEchoMode`
- `setMode`
- `SetSendReceiveMode`
- `SM`
- `SRM`

**Mouse** (from `mouse.ts`)

- `disableAnyEventMouse`
- `disableButtonEventMouse`
- `disableFocusTracking`
- `disableNormalMouse`
- `disableSgrMouse`
- `disableX10Mouse`
- `enableAnyEventMouse`
- `enableButtonEventMouse`
- `enableFocusTracking`
- `enableNormalMouse`
- `enableSgrMouse`
- `enableX10Mouse`
- `encodeMouseButtonByte`
- `MouseButton`
- `mouseSgrSequence`
- `mouseX10Sequence`

**Passthrough** (from `passthrough.ts`)

- `SCREEN_MAX_LEN_DEFAULT`
- `SCREEN_TYPICAL_LIMIT`
- `screenPassthrough`
- `tmuxPassthrough`

**Reset** (from `reset.ts`)

- `RESET_INITIAL_STATE`
- `RIS`

**Screen** (from `screen.ts`)

- `clearTabStop`
- `deleteCharacter`
- `deleteLine`
- `insertCharacter`
- `insertLine`
- `repeatPreviousCharacter`
- `requestPresentationStateReport`
- `setLeftRightMargins`
- `setTopBottomMargins`

**Scroll** (from `scroll.ts`)

- `SCROLL_DOWN_1`
- `SCROLL_UP_1`
- `scrollDown`
- `scrollUp`

**Status** (from `status.ts`)

- `CPR`
- `createAnsiStatusReport`
- `createDecStatusReport`
- `cursorPositionReport`
- `DA1`
- `DA2`
- `DA3`
- `DECXCPR`
- `deviceStatusReport`
- `DSR`
- `DSR_KeyboardLanguageDEC`
- `DSR_PrinterStatusDEC`
- `DSR_TerminalStatus`
- `DSR_UDKStatusDEC`
- `extendedCursorPositionReport`
- `reportKeyboardLanguageDEC`
- `reportPrimaryDeviceAttributes`
- `reportPrinterNoPaperDEC`
- `reportPrinterNotReadyDEC`
- `reportPrinterReadyDEC`
- `reportSecondaryDeviceAttributes`
- `reportTerminalNotOK`
- `reportTerminalOK`
- `reportTertiaryDeviceAttributes`
- `reportUDKLockedDEC`
- `reportUDKUnlockedDEC`
- `requestCursorPositionReport`
- `requestExtendedCursorPositionReport`
- `requestKeyboardLanguageDEC`
- `RequestNameVersion`
- `requestPrimaryDeviceAttributes`
- `requestPrimaryDeviceAttributesParam0`
- `requestPrinterStatusDEC`
- `requestSecondaryDeviceAttributes`
- `requestSecondaryDeviceAttributesParam0`
- `requestTerminalStatus`
- `requestTertiaryDeviceAttributes`
- `requestTertiaryDeviceAttributesParam0`
- `requestUDKStatusDEC`
- `XTVERSION`

**Strip** (from `strip.ts`)

- `strip`

**Termcap/Terminfo** (from `termcap.ts`)

- `requestTermcap`
- `requestTerminfo`
- `XTGETTCAP`

**Title** (from `title.ts`)

- `decsin`
- `decswt`
- `setIconName`
- `setIconNameAndWindowTitle`
- `setIconNameAndWindowTitleWithST`
- `setIconNameWithST`
- `setWindowTitle`
- `setWindowTitleWithST`

**Window Operations** (from `window-ops.ts`)

- `deiconifyWindow`
- `iconifyWindow`
- `lowerWindow`
- `maximizeWindow`
- `moveWindow`
- `raiseWindow`
- `refreshWindow`
- `reportWindowPosition`
- `reportWindowState`
- `requestCellSizePixels`
- `requestFullScreen`
- `requestTextAreaSizeChars`
- `requestTextAreaSizePixels`
- `requestWindowPosition`
- `requestWindowSizeChars`
- `requestWindowSizePixels`
- `resizeTextAreaChars`
- `resizeTextAreaPixels`
- `restoreWindow`
- `XTWINOPS`

**XTerm** (from `xterm.ts`)

- `xtermBell`
- `xtermManipulateWindow`
- `xtermReport`
- `xtermRequest`
- `xtermSet`

## Related

- [ansi-escapes](https://github.com/sindresorhus/ansi-escapes) - ANSI escape codes for manipulating the terminal
- [sisteransi](https://github.com/terkelg/sisteransi) - ANSI escape codes for some terminal swag.
- [console-clear](https://github.com/lukeed/console-clear) - Clear the console, cross-platform

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima ansi is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/ansi?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/ansi?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/ansi
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
