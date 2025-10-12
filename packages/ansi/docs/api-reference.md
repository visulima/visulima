---
title: API Reference
description: Complete reference for all functions and constants in @visulima/ansi
---

## Cursor Control

<Callout type="info">
Module: `@visulima/ansi/cursor`
</Callout>

### cursorTo()

<TypeTable 
  type={{
    x: { type: 'number', description: 'Column position (0-indexed)' },
    y: { type: 'number | undefined', description: 'Row position (0-indexed, optional)' }
  }}
/>

Moves the cursor to specific coordinates (0-indexed).

```typescript title="signature"
cursorTo(x: number, y?: number): string
```

```typescript title="example.ts"
// Move to top-left corner
process.stdout.write(cursorTo(0, 0));

// Move to column 10 on current line
process.stdout.write(cursorTo(10));
```

### cursorMove()

Moves the cursor relative to its current position.

```typescript title="signature"
cursorMove(x: number, y: number): string
```

```typescript title="example.ts"
// Move 5 columns right and 2 rows up
process.stdout.write(cursorMove(5, -2));
```

<Callout>
Positive `x` moves right, negative left. Positive `y` moves down, negative up.
</Callout>

### cursorUp()

Moves the cursor up by the specified number of rows.

```typescript title="signature"
cursorUp(count?: number): string
```

```typescript title="example.ts"
process.stdout.write(cursorUp(3));
```

### cursorDown()

Moves the cursor down by the specified number of rows.

```typescript title="signature"
cursorDown(count?: number): string
```

### cursorForward()

Moves the cursor forward (right) by the specified number of columns.

```typescript
cursorForward(count?: number): string
```

---

#### cursorBackward(count?)

Moves the cursor backward (left) by the specified number of columns.

```typescript
cursorBackward(count?: number): string
```

---

#### cursorLeft

Alias for `cursorBackward()`. Moves cursor left by 1000 columns (effectively to start of line).

```typescript
cursorLeft: string
```

---

#### cursorNextLine(count?)

Moves cursor to beginning of next line, `count` times.

```typescript
cursorNextLine(count?: number): string
```

---

#### cursorPreviousLine(count?)

Moves cursor to beginning of previous line, `count` times.

```typescript
cursorPreviousLine(count?: number): string
```

---

#### cursorPosition(row, column?)

Moves cursor to specific position (1-indexed).

```typescript
cursorPosition(row: number, column?: number): string
```

**Note:** Unlike `cursorTo()`, this uses 1-indexed coordinates.

---

#### cursorHorizontalAbsolute(column?)

Moves cursor to absolute column position.

```typescript
cursorHorizontalAbsolute(column?: number): string
```

---

#### cursorVerticalAbsolute(row?)

Moves cursor to absolute row position.

```typescript
cursorVerticalAbsolute(row?: number): string
```

---

#### cursorHide

Hides the cursor.

```typescript
cursorHide: string
```

**Example:**
```typescript
process.stdout.write(cursorHide);
```

---

#### cursorShow

Shows the cursor.

```typescript
cursorShow: string
```

**Example:**
```typescript
process.stdout.write(cursorShow);
```

---

#### cursorSave

Saves the current cursor position.

```typescript
cursorSave: string
```

---

#### cursorRestore

Restores the previously saved cursor position.

```typescript
cursorRestore: string
```

---

#### setCursorStyle(style)

Sets the cursor style.

```typescript
setCursorStyle(style: CursorStyle | number): string
```

**Parameters:**
- `style` - Cursor style from `CursorStyle` enum

**CursorStyle enum values:**
- `CursorStyle.Default` (0)
- `CursorStyle.BlinkingBlock` (1)
- `CursorStyle.SteadyBlock` (2)
- `CursorStyle.BlinkingUnderline` (3)
- `CursorStyle.SteadyUnderline` (4)
- `CursorStyle.BlinkingBar` (5)
- `CursorStyle.SteadyBar` (6)

**Example:**
```typescript
import { setCursorStyle, CursorStyle } from "@visulima/ansi/cursor";

process.stdout.write(setCursorStyle(CursorStyle.BlinkingBar));
```

---

#### eraseCharacter(count?)

Erases characters from cursor position forward.

```typescript
eraseCharacter(count?: number): string
```

---

#### restoreCursor()

Function from `restore-cursor` package that ensures cursor is shown on exit.

```typescript
restoreCursor(): void
```

**Example:**
```typescript
import { restoreCursor } from "@visulima/ansi/cursor";

restoreCursor(); // Automatically shows cursor on exit
```

---

### Constants

- `SAVE_CURSOR_DEC` - DEC save cursor sequence
- `RESTORE_CURSOR_DEC` - DEC restore cursor sequence
- `CURSOR_UP_1` - Move cursor up 1 line
- `CURSOR_DOWN_1` - Move cursor down 1 line
- `CURSOR_FORWARD_1` - Move cursor forward 1 column
- `CURSOR_BACKWARD_1` - Move cursor backward 1 column
- `REQUEST_CURSOR_POSITION` - Request cursor position report
- `REQUEST_EXTENDED_CURSOR_POSITION` - Request extended cursor position

---

## Erase Functions

Module: `@visulima/ansi/erase`

### Functions

#### eraseLine

Erases the current line.

```typescript
eraseLine: string
```

---

#### eraseLineStart

Erases from cursor to start of line.

```typescript
eraseLineStart: string
```

---

#### eraseLineEnd

Erases from cursor to end of line.

```typescript
eraseLineEnd: string
```

---

#### eraseLines(count)

Erases `count` lines from cursor position.

```typescript
eraseLines(count: number): string
```

---

#### eraseDown

Erases from cursor to end of screen.

```typescript
eraseDown: string
```

---

#### eraseUp

Erases from cursor to start of screen.

```typescript
eraseUp: string
```

---

#### eraseScreen

Erases the entire screen.

```typescript
eraseScreen: string
```

---

#### eraseScreenAndScrollback

Erases screen and scrollback buffer.

```typescript
eraseScreenAndScrollback: string
```

---

#### eraseDisplay(mode)

Erases display based on mode.

```typescript
eraseDisplay(mode: 0 | 1 | 2 | 3): string
```

**Parameters:**
- `0` - Erase from cursor to end of screen
- `1` - Erase from cursor to start of screen
- `2` - Erase entire screen
- `3` - Erase entire screen and scrollback

---

#### eraseInLine(mode)

Erases in line based on mode.

```typescript
eraseInLine(mode: 0 | 1 | 2): string
```

**Parameters:**
- `0` - Erase from cursor to end of line
- `1` - Erase from cursor to start of line
- `2` - Erase entire line

---

## Clear Functions

Module: `@visulima/ansi/clear`

### Functions

#### clearScreen

Clears the entire screen (alias for `eraseScreen`).

```typescript
clearScreen: string
```

---

#### clearScreenFromTopLeft

Moves cursor to top-left and clears screen.

```typescript
clearScreenFromTopLeft: string
```

---

#### clearScreenAndHomeCursor

Clears screen and moves cursor to home position.

```typescript
clearScreenAndHomeCursor: string
```

---

#### clearLineAndHomeCursor

Clears current line and moves cursor to column 1.

```typescript
clearLineAndHomeCursor: string
```

---

#### resetTerminal

Performs a soft reset of the terminal.

```typescript
resetTerminal: string
```

---

## Screen Manipulation

Module: `@visulima/ansi/screen`

### Functions

#### insertLine(count?)

Inserts blank lines at cursor position.

```typescript
insertLine(count?: number): string
```

---

#### deleteLine(count?)

Deletes lines at cursor position.

```typescript
deleteLine(count?: number): string
```

---

#### insertCharacter(count?)

Inserts blank characters at cursor position.

```typescript
insertCharacter(count?: number): string
```

---

#### deleteCharacter(count?)

Deletes characters at cursor position.

```typescript
deleteCharacter(count?: number): string
```

---

#### repeatPreviousCharacter(count?)

Repeats the previous character.

```typescript
repeatPreviousCharacter(count?: number): string
```

---

#### setTopBottomMargins(top?, bottom?)

Sets scrolling region margins.

```typescript
setTopBottomMargins(top?: number, bottom?: number): string
```

---

#### setLeftRightMargins(left?, right?)

Sets left and right margins.

```typescript
setLeftRightMargins(left?: number, right?: number): string
```

---

#### clearTabStop

Clears tab stop at cursor position.

```typescript
clearTabStop: string
```

---

## Scroll Functions

Module: `@visulima/ansi/scroll`

### Functions

#### scrollUp(count?)

Scrolls content up by specified lines.

```typescript
scrollUp(count?: number): string
```

---

#### scrollDown(count?)

Scrolls content down by specified lines.

```typescript
scrollDown(count?: number): string
```

---

### Constants

- `SCROLL_UP_1` - Scroll up 1 line
- `SCROLL_DOWN_1` - Scroll down 1 line

## Hyperlinks

<Callout type="info">
Module: `@visulima/ansi/hyperlink`
</Callout>

### hyperlink()

Creates a clickable hyperlink in the terminal.

```typescript title="signature"
hyperlink(text: string, url: string): string
```

<Callout type="warn">
Terminal support varies. Not all terminals support clickable hyperlinks.
</Callout>

```typescript title="example.ts"
import hyperlink from "@visulima/ansi/hyperlink";

const link = hyperlink("Visulima", "https://visulima.com");
console.log(`Visit ${link} for more info`);
```

## Images

<Callout type="info">
Module: `@visulima/ansi/image`
</Callout>

### image()

Displays an inline image (iTerm2 only).

```typescript title="signature"
image(data: Uint8Array, options?: ImageOptions): string
```

**ImageOptions:**

| Property | Type | Description |
|----------|------|-------------|
| `width` | `number \| string \| "auto"` | Display width |
| `height` | `number \| string \| "auto"` | Display height |
| `preserveAspectRatio` | `boolean` | Preserve aspect ratio (default: true) |

<Callout type="warn">
This feature is specific to iTerm2 and will not work in other terminals.
</Callout>

```typescript title="example.ts"
import { image } from "@visulima/ansi/image";
import { readFileSync } from "fs";

const imageData = readFileSync("image.png");
const sequence = image(new Uint8Array(imageData), {
    width: 50,
    height: "auto",
    preserveAspectRatio: true
});

process.stdout.write(sequence);
```

## Strip ANSI Codes

<Callout type="info">
Module: `@visulima/ansi/strip`
</Callout>

### strip()

Removes all ANSI escape codes from a string.

```typescript title="signature"
strip(input: string): string
```

```typescript title="example.ts"
import strip from "@visulima/ansi/strip";

const styled = "\x1b[32mHello\x1b[0m";
const plain = strip(styled);
console.log(plain); // "Hello"

// Useful for calculating actual string length
const styledText = "\x1b[32mHello\x1b[0m \x1b[1mWorld\x1b[0m";
const actualLength = strip(styledText).length; // 11
```

## Title Functions

Module: `@visulima/ansi/title`

### Functions

#### setWindowTitle(title)

Sets the window title.

```typescript
setWindowTitle(title: string): string
```

---

#### setIconName(name)

Sets the icon name.

```typescript
setIconName(name: string): string
```

---

#### setIconNameAndWindowTitle(title)

Sets both icon name and window title.

```typescript
setIconNameAndWindowTitle(title: string): string
```

---

### Alternative Versions with String Terminator

Functions with `WithST` suffix use ST (String Terminator) instead of BEL:

- `setWindowTitleWithST(title)`
- `setIconNameWithST(name)`
- `setIconNameAndWindowTitleWithST(title)`

---

## Mouse Functions

Module: `@visulima/ansi/mouse`

### Functions

#### enableNormalMouse()

Enables normal mouse tracking.

```typescript
enableNormalMouse(): string
```

---

#### disableNormalMouse()

Disables normal mouse tracking.

```typescript
disableNormalMouse(): string
```

---

#### enableX10Mouse()

Enables X10 mouse tracking.

```typescript
enableX10Mouse(): string
```

---

#### disableX10Mouse()

Disables X10 mouse tracking.

```typescript
disableX10Mouse(): string
```

---

#### enableButtonEventMouse()

Enables button event mouse tracking.

```typescript
enableButtonEventMouse(): string
```

---

#### disableButtonEventMouse()

Disables button event mouse tracking.

```typescript
disableButtonEventMouse(): string
```

---

#### enableAnyEventMouse()

Enables any event mouse tracking.

```typescript
enableAnyEventMouse(): string
```

---

#### disableAnyEventMouse()

Disables any event mouse tracking.

```typescript
disableAnyEventMouse(): string
```

---

#### enableSgrMouse()

Enables SGR mouse tracking.

```typescript
enableSgrMouse(): string
```

---

#### disableSgrMouse()

Disables SGR mouse tracking.

```typescript
disableSgrMouse(): string
```

---

#### enableFocusTracking()

Enables focus tracking events.

```typescript
enableFocusTracking(): string
```

---

#### disableFocusTracking()

Disables focus tracking events.

```typescript
disableFocusTracking(): string
```

---

## Mode Functions

Module: `@visulima/ansi/mode`

Mode functions control various terminal modes.

### Functions

#### setMode(mode)

Sets a terminal mode.

```typescript
setMode(mode: string): string
```

---

#### resetMode(mode)

Resets a terminal mode.

```typescript
resetMode(mode: string): string
```

---

#### requestMode(mode)

Requests the status of a mode.

```typescript
requestMode(mode: string): string
```

---

#### reportMode(mode, state)

Reports a mode state.

```typescript
reportMode(mode: number, state: number): string
```

---

### Mode State Checkers

```typescript
isModeSet(state: number): boolean
isModeReset(state: number): boolean
isModePermanentlySet(state: number): boolean
isModePermanentlyReset(state: number): boolean
isModeNotRecognized(state: number): boolean
```

---

## Status Functions

Module: `@visulima/ansi/status`

### Functions

#### requestCursorPositionReport()

Requests cursor position from terminal.

```typescript
requestCursorPositionReport(): string
```

---

#### requestPrimaryDeviceAttributes()

Requests primary device attributes.

```typescript
requestPrimaryDeviceAttributes(): string
```

---

#### requestSecondaryDeviceAttributes()

Requests secondary device attributes.

```typescript
requestSecondaryDeviceAttributes(): string
```

---

#### requestTertiaryDeviceAttributes()

Requests tertiary device attributes.

```typescript
requestTertiaryDeviceAttributes(): string
```

---

## Window Operations

Module: `@visulima/ansi/window-ops`

### Functions

#### minimizeWindow()

Minimizes (iconifies) the window.

```typescript
iconifyWindow(): string
```

---

#### maximizeWindow()

Maximizes the window.

```typescript
maximizeWindow(): string
```

---

#### restoreWindow()

Restores the window from minimized state.

```typescript
deiconifyWindow(): string
```

---

#### raiseWindow()

Raises the window to front.

```typescript
raiseWindow(): string
```

---

#### lowerWindow()

Lowers the window to back.

```typescript
lowerWindow(): string
```

---

#### moveWindow(x, y)

Moves the window to specified position.

```typescript
moveWindow(x: number, y: number): string
```

---

#### refreshWindow()

Refreshes the window.

```typescript
refreshWindow(): string
```

---

## Alternative Screen

Module: `@visulima/ansi/alternative-screen`

### Functions

#### alternativeScreenOn()

Switches to alternative screen buffer.

```typescript
alternativeScreenOn(): string
```

---

#### alternativeScreenOff()

Switches back to main screen buffer.

```typescript
alternativeScreenOff(): string
```

---

### Constants

- `ALT_SCREEN_ON` - Enable alternative screen
- `ALT_SCREEN_OFF` - Disable alternative screen

---

## Passthrough Sequences

Module: `@visulima/ansi/passthrough`

### Functions

#### tmuxPassthrough(sequence)

Wraps sequence for tmux passthrough.

```typescript
tmuxPassthrough(sequence: string): string
```

---

#### screenPassthrough(sequence, maxLength?)

Wraps sequence for GNU screen passthrough.

```typescript
screenPassthrough(sequence: string, maxLength?: number): string
```

---

## Reset Functions

Module: `@visulima/ansi/reset`

### Constants

#### RIS / RESET_INITIAL_STATE

Performs full terminal reset (RIS - Reset to Initial State).

```typescript
RIS: string
RESET_INITIAL_STATE: string
```

**Example:**
```typescript
import { RIS } from "@visulima/ansi/reset";

// Full terminal reset
process.stdout.write(RIS);
```

---

## Additional Modules

### Termcap/Terminfo

Module: `@visulima/ansi/termcap`

Functions for requesting terminal capabilities.

---

### iTerm2

Module: `@visulima/ansi/iterm2`

Additional iTerm2-specific functionality.

---

### XTerm

Module: `@visulima/ansi/xterm`

XTerm-specific extensions and operations.

---

## General Function

### beep

Produces a beep sound.

```typescript
beep: string
```

**Example:**
```typescript
import { beep } from "@visulima/ansi";

process.stdout.write(beep);
```

## Best Practices

<Callout type="info">
Follow these guidelines for reliable terminal applications.
</Callout>

1. **Always restore state** - Show cursor before exit if hidden
2. **Use constants** - They're optimized and pre-calculated
3. **Combine sequences** - More efficient than multiple writes
4. **Test compatibility** - Not all terminals support all features
5. **Handle errors** - Terminal operations can fail

```typescript title="good-practice.ts"
// Good - combined sequences
process.stdout.write(cursorHide + cursorTo(0, 0) + eraseLine);

// Less efficient - multiple writes
process.stdout.write(cursorHide);
process.stdout.write(cursorTo(0, 0));
process.stdout.write(eraseLine);
```
