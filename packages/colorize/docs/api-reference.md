# API Reference

Complete API reference for `@visulima/colorize`.

## Table of Contents

- [Colors](#colors)
  - [Standard Colors](#standard-colors)
  - [Bright Colors](#bright-colors)
  - [Background Colors](#background-colors)
  - [Bright Background Colors](#bright-background-colors)
- [Styles](#styles)
- [TrueColor](#truecolor)
- [ANSI 256 Colors](#ansi-256-colors)
- [Utilities](#utilities)
- [Types](#types)

## Colors

### Standard Colors

Basic ANSI 16 colors for foreground text.

#### `black(text: string): string`

Applies black color to text.

```typescript
import { black } from '@visulima/colorize';
console.log(black('Black text'));
```

#### `red(text: string): string`

Applies red color to text.

```typescript
import { red } from '@visulima/colorize';
console.log(red('Red text'));
console.log(red`Red text using template`);
```

#### `green(text: string): string`

Applies green color to text.

```typescript
import { green } from '@visulima/colorize';
console.log(green('Green text'));
```

#### `yellow(text: string): string`

Applies yellow color to text.

```typescript
import { yellow } from '@visulima/colorize';
console.log(yellow('Yellow text'));
```

#### `blue(text: string): string`

Applies blue color to text.

```typescript
import { blue } from '@visulima/colorize';
console.log(blue('Blue text'));
```

#### `magenta(text: string): string`

Applies magenta color to text.

```typescript
import { magenta } from '@visulima/colorize';
console.log(magenta('Magenta text'));
```

#### `cyan(text: string): string`

Applies cyan color to text.

```typescript
import { cyan } from '@visulima/colorize';
console.log(cyan('Cyan text'));
```

#### `white(text: string): string`

Applies white color to text.

```typescript
import { white } from '@visulima/colorize';
console.log(white('White text'));
```

#### `gray(text: string): string`

Alias: `grey`

Applies gray color to text.

```typescript
import { gray, grey } from '@visulima/colorize';
console.log(gray('Gray text'));
console.log(grey('Grey text')); // Same as gray
```

### Bright Colors

Brighter versions of standard colors.

#### `blackBright(text: string): string`

Applies bright black (dark gray) color to text.

```typescript
import { blackBright } from '@visulima/colorize';
console.log(blackBright('Bright black text'));
```

#### `redBright(text: string): string`

Applies bright red color to text.

```typescript
import { redBright } from '@visulima/colorize';
console.log(redBright('Bright red text'));
```

#### `greenBright(text: string): string`

Applies bright green color to text.

```typescript
import { greenBright } from '@visulima/colorize';
console.log(greenBright('Bright green text'));
```

#### `yellowBright(text: string): string`

Applies bright yellow color to text.

```typescript
import { yellowBright } from '@visulima/colorize';
console.log(yellowBright('Bright yellow text'));
```

#### `blueBright(text: string): string`

Applies bright blue color to text.

```typescript
import { blueBright } from '@visulima/colorize';
console.log(blueBright('Bright blue text'));
```

#### `magentaBright(text: string): string`

Applies bright magenta color to text.

```typescript
import { magentaBright } from '@visulima/colorize';
console.log(magentaBright('Bright magenta text'));
```

#### `cyanBright(text: string): string`

Applies bright cyan color to text.

```typescript
import { cyanBright } from '@visulima/colorize';
console.log(cyanBright('Bright cyan text'));
```

#### `whiteBright(text: string): string`

Applies bright white color to text.

```typescript
import { whiteBright } from '@visulima/colorize';
console.log(whiteBright('Bright white text'));
```

### Background Colors

Standard background colors.

#### `bgBlack(text: string): string`

Applies black background to text.

```typescript
import { bgBlack, white } from '@visulima/colorize';
console.log(white.bgBlack('White text on black background'));
```

#### `bgRed(text: string): string`

Applies red background to text.

```typescript
import { bgRed, white } from '@visulima/colorize';
console.log(white.bgRed('White text on red background'));
```

#### `bgGreen(text: string): string`

Applies green background to text.

```typescript
import { bgGreen, black } from '@visulima/colorize';
console.log(black.bgGreen('Black text on green background'));
```

#### `bgYellow(text: string): string`

Applies yellow background to text.

```typescript
import { bgYellow, black } from '@visulima/colorize';
console.log(black.bgYellow('Black text on yellow background'));
```

#### `bgBlue(text: string): string`

Applies blue background to text.

```typescript
import { bgBlue, white } from '@visulima/colorize';
console.log(white.bgBlue('White text on blue background'));
```

#### `bgMagenta(text: string): string`

Applies magenta background to text.

```typescript
import { bgMagenta, white } from '@visulima/colorize';
console.log(white.bgMagenta('White text on magenta background'));
```

#### `bgCyan(text: string): string`

Applies cyan background to text.

```typescript
import { bgCyan, black } from '@visulima/colorize';
console.log(black.bgCyan('Black text on cyan background'));
```

#### `bgWhite(text: string): string`

Applies white background to text.

```typescript
import { bgWhite, black } from '@visulima/colorize';
console.log(black.bgWhite('Black text on white background'));
```

#### `bgGray(text: string): string`

Alias: `bgGrey`

Applies gray background to text.

```typescript
import { bgGray, white } from '@visulima/colorize';
console.log(white.bgGray('White text on gray background'));
```

### Bright Background Colors

Brighter versions of background colors.

#### `bgBlackBright(text: string): string`

Applies bright black background to text.

```typescript
import { bgBlackBright, white } from '@visulima/colorize';
console.log(white.bgBlackBright('Text on bright black background'));
```

#### `bgRedBright(text: string): string`

Applies bright red background to text.

```typescript
import { bgRedBright, white } from '@visulima/colorize';
console.log(white.bgRedBright('Text on bright red background'));
```

#### `bgGreenBright(text: string): string`

Applies bright green background to text.

```typescript
import { bgGreenBright, black } from '@visulima/colorize';
console.log(black.bgGreenBright('Text on bright green background'));
```

#### `bgYellowBright(text: string): string`

Applies bright yellow background to text.

```typescript
import { bgYellowBright, black } from '@visulima/colorize';
console.log(black.bgYellowBright('Text on bright yellow background'));
```

#### `bgBlueBright(text: string): string`

Applies bright blue background to text.

```typescript
import { bgBlueBright, white } from '@visulima/colorize';
console.log(white.bgBlueBright('Text on bright blue background'));
```

#### `bgMagentaBright(text: string): string`

Applies bright magenta background to text.

```typescript
import { bgMagentaBright, white } from '@visulima/colorize';
console.log(white.bgMagentaBright('Text on bright magenta background'));
```

#### `bgCyanBright(text: string): string`

Applies bright cyan background to text.

```typescript
import { bgCyanBright, black } from '@visulima/colorize';
console.log(black.bgCyanBright('Text on bright cyan background'));
```

#### `bgWhiteBright(text: string): string`

Applies bright white background to text.

```typescript
import { bgWhiteBright, black } from '@visulima/colorize';
console.log(black.bgWhiteBright('Text on bright white background'));
```

## Styles

Text styling modifiers.

#### `bold(text: string): string`

Makes text bold.

```typescript
import { bold } from '@visulima/colorize';
console.log(bold('Bold text'));
```

#### `dim(text: string): string`

Makes text dimmed (decreased intensity).

```typescript
import { dim } from '@visulima/colorize';
console.log(dim('Dimmed text'));
```

#### `italic(text: string): string`

Makes text italic.

```typescript
import { italic } from '@visulima/colorize';
console.log(italic('Italic text'));
```

#### `underline(text: string): string`

Underlines text.

```typescript
import { underline } from '@visulima/colorize';
console.log(underline('Underlined text'));
```

#### `strikethrough(text: string): string`

Alias: `strike`

Applies strikethrough to text.

```typescript
import { strikethrough, strike } from '@visulima/colorize';
console.log(strikethrough('Strikethrough text'));
console.log(strike('Strike text')); // Same as strikethrough
```

#### `inverse(text: string): string`

Inverts foreground and background colors.

```typescript
import { inverse, red } from '@visulima/colorize';
console.log(inverse('Inverted text'));
console.log(red.inverse('Inverted red text'));
```

#### `hidden(text: string): string`

Hides text (makes it invisible).

```typescript
import { hidden } from '@visulima/colorize';
console.log(hidden('Hidden text'));
```

#### `visible(text: string): string`

Ensures text is visible (no-op if colors are disabled).

```typescript
import { visible } from '@visulima/colorize';
console.log(visible('Visible text'));
```

#### `reset(text: string): string`

Resets all styles.

```typescript
import { reset, red } from '@visulima/colorize';
console.log(red('Red') + reset(' Normal'));
```

#### `overline(text: string): string`

Applies overline to text.

```typescript
import { overline } from '@visulima/colorize';
console.log(overline('Overlined text'));
```

## TrueColor

Functions for 16 million color support.

### Foreground Colors

#### `hex(color: string): ColorizeFunction`

Applies hex color to text foreground.

**Parameters:**
- `color` - Hex color string (with or without #, long or short form)

```typescript
import { hex } from '@visulima/colorize';

console.log(hex('#FF0000')('Red text'));
console.log(hex('FF0000')('Red text')); // # is optional
console.log(hex('#F00')('Red text')); // Short form
console.log(hex('F00')('Red text'));

// Chainable
console.log(hex('#FF69B4').bold('Bold hot pink'));
```

#### `rgb(red: number, green: number, blue: number): ColorizeFunction`

Applies RGB color to text foreground.

**Parameters:**
- `red` - Red value (0-255)
- `green` - Green value (0-255)
- `blue` - Blue value (0-255)

```typescript
import { rgb } from '@visulima/colorize';

console.log(rgb(255, 0, 0)('Red text'));
console.log(rgb(255, 105, 180)('Hot pink text'));

// Chainable
console.log(rgb(0, 255, 0).bold('Bold green'));
```

### Background Colors

#### `bgHex(color: string): ColorizeFunction`

Applies hex color to text background.

**Parameters:**
- `color` - Hex color string (with or without #, long or short form)

```typescript
import { bgHex, black } from '@visulima/colorize';

console.log(black.bgHex('#FF0000')('Black on red'));
console.log(bgHex('#FF69B4')('Hot pink background'));
```

#### `bgRgb(red: number, green: number, blue: number): ColorizeFunction`

Applies RGB color to text background.

**Parameters:**
- `red` - Red value (0-255)
- `green` - Green value (0-255)
- `blue` - Blue value (0-255)

```typescript
import { bgRgb, white } from '@visulima/colorize';

console.log(white.bgRgb(255, 0, 0)('White on red'));
console.log(bgRgb(255, 105, 180)('Hot pink background'));
```

## ANSI 256 Colors

Functions for extended 256-color palette.

#### `ansi256(code: number): ColorizeFunction`

Alias: `fg`

Applies ANSI 256 color to text foreground.

**Parameters:**
- `code` - Color code (0-255)

**Color Ranges:**
- 0-7: Standard colors
- 8-15: Bright colors
- 16-231: 6 × 6 × 6 cube (216 colors)
- 232-255: Grayscale from black to white (24 steps)

```typescript
import { ansi256, fg } from '@visulima/colorize';

console.log(ansi256(196)('Red text'));
console.log(fg(196)('Red text')); // Same as ansi256

// Chainable
console.log(ansi256(51).bold('Cyan bold text'));
```

#### `bgAnsi256(code: number): ColorizeFunction`

Alias: `bg`

Applies ANSI 256 color to text background.

**Parameters:**
- `code` - Color code (0-255)

```typescript
import { bgAnsi256, bg, black } from '@visulima/colorize';

console.log(black.bgAnsi256(196)('Black on red'));
console.log(black.bg(196)('Black on red')); // Same as bgAnsi256
```

## Utilities

### `strip(text: string): string`

Removes all ANSI escape codes from a string.

```typescript
import { strip, red, bold } from '@visulima/colorize';

const styled = red.bold('Error message');
const plain = strip(styled);

console.log(styled); // Styled output
console.log(plain);  // 'Error message'
```

**Use Cases:**
- Writing to log files
- Testing output
- Calculating actual string length
- Text processing

### `convertHexToRgb(hex: string): [number, number, number]`

Converts hex color to RGB values.

**Import from utils:**
```typescript
import { convertHexToRgb } from '@visulima/colorize/utils';

const [r, g, b] = convertHexToRgb('#FF0000');
console.log(r, g, b); // 255, 0, 0

// Works with short form
const [r2, g2, b2] = convertHexToRgb('#F00');
console.log(r2, g2, b2); // 255, 0, 0

// Without #
const [r3, g3, b3] = convertHexToRgb('FF0000');
console.log(r3, g3, b3); // 255, 0, 0
```

## Chaining

All colors, backgrounds, and styles can be chained together in any order:

```typescript
import { red, bold, underline, bgYellow } from '@visulima/colorize';

// Chain styles
console.log(red.bold('Red and bold'));
console.log(red.bold.underline('Red, bold, and underlined'));

// Chain with backgrounds
console.log(red.bgYellow('Red on yellow'));
console.log(red.bold.bgYellow('Bold red on yellow'));

// Complex chains
console.log(red.bold.underline.bgYellow('All combined'));
```

## Template Literals

All functions support tagged template literals:

```typescript
import { red, blue, bold } from '@visulima/colorize';

// Simple template
console.log(red`Error message`);

// With variables
const file = 'config.js';
console.log(red`Error in ${file}`);

// Nested templates
console.log(red`Error: ${blue`file ${bold`config.js`}`} not found`);
```

## ANSI Codes

Each style exposes `open` and `close` properties containing the raw ANSI escape codes:

```typescript
import { red, bold } from '@visulima/colorize';

console.log(`Hello ${red.open}World${red.close}!`);
console.log(`${bold.open}Bold text${bold.close}`);

// Create custom style
const myStyle = red.bold.bgYellow;
console.log(`${myStyle.open}Custom style${myStyle.close}`);
```

## Types

### `ColorizeType`

The main Colorize type containing all colors, styles, and utilities.

```typescript
import type { ColorizeType } from '@visulima/colorize';

const colorize: ColorizeType = require('@visulima/colorize');
```

### `AnsiColors`

Type representing all available color functions.

```typescript
import type { AnsiColors } from '@visulima/colorize';
```

### `AnsiStyles`

Type representing all available style functions.

```typescript
import type { AnsiStyles } from '@visulima/colorize';
```

## Default Import

All functions are also available on the default import:

```typescript
import colorize from '@visulima/colorize';

console.log(colorize.red('Red'));
console.log(colorize.bold('Bold'));
console.log(colorize.hex('#FF0000')('Hex red'));
console.log(colorize.strip(colorize.red('Styled')));
```

## Color Support Detection

Colorize automatically detects color support based on:
- Terminal capabilities (`TERM` environment variable)
- `FORCE_COLOR` and `NO_COLOR` environment variables
- `--color` and `--no-color` CLI flags
- TTY detection
- CI environment detection

The appropriate color space is automatically selected:
1. TrueColor (16 million colors)
2. 256 colors
3. 16 colors (basic ANSI)
4. No colors (black and white)

See [Environment Variables & CLI](./cli-environment.md) for details.

## Browser API

The browser version has the same API but returns arrays for use with `console.log`:

```typescript
import { red, green } from '@visulima/colorize/browser';

// Note the spread operator
console.log(...red('Error'));
console.log(...green('Success'));
```

See [Browser Usage](./browser.md) for complete browser documentation.

## Related

- [Examples](./examples.md) - Practical usage examples
- [Advanced Features](./advanced.md) - Gradients and templates
- [Getting Started](./getting-started.md) - Basic usage guide
