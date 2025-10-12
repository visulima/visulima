# Getting Started

This guide will help you get up and running with `@visulima/colorize` in just a few minutes.

## Your First Colorize Program

After [installing](./installation.md) Colorize, create a simple script:

```typescript
import { red, green, blue } from '@visulima/colorize';

console.log(red('Error: Something went wrong!'));
console.log(green('Success: Operation completed!'));
console.log(blue('Info: Processing data...'));
```

Run your script:

```bash
node app.js
```

You should see colored output in your terminal.

## Basic Concepts

### Named Import vs Default Import

Colorize supports two import styles:

```typescript
// Named imports (recommended)
import { red, green, bold } from '@visulima/colorize';

red('text');
bold('text');

// Default import
import colorize from '@visulima/colorize';

colorize.red('text');
colorize.bold('text');
```

### Function Syntax vs Template Literals

You can style text using either function calls or template literals:

```typescript
import { red, blue } from '@visulima/colorize';

// Function syntax
console.log(red('Error message'));

// Template literal syntax
console.log(red`Error message`);

// Both produce the same result
```

Template literals are especially useful for complex strings:

```typescript
const fileName = 'config.json';
const lineNumber = 42;

// Clean and readable
console.log(red`Error in ${blue(fileName)} at line ${lineNumber}`);
```

## Common Use Cases

### Logging Levels

Create distinct visual styles for different log levels:

```typescript
import { red, yellow, blue, green, gray } from '@visulima/colorize';

function log(level, message) {
  switch (level) {
    case 'error':
      console.log(red(`[ERROR] ${message}`));
      break;
    case 'warn':
      console.log(yellow(`[WARN] ${message}`));
      break;
    case 'info':
      console.log(blue(`[INFO] ${message}`));
      break;
    case 'success':
      console.log(green(`[SUCCESS] ${message}`));
      break;
    case 'debug':
      console.log(gray(`[DEBUG] ${message}`));
      break;
  }
}

log('error', 'Connection failed');
log('warn', 'Deprecated API usage');
log('info', 'Server started on port 3000');
log('success', 'Build completed');
log('debug', 'Variable state: { x: 1, y: 2 }');
```

### Command-Line Interface (CLI)

Enhance your CLI output:

```typescript
import { bold, green, red, yellow, cyan } from '@visulima/colorize';

console.log(bold(cyan('My Awesome CLI v1.0.0')));
console.log();

console.log(bold('Usage:'));
console.log('  my-cli [command] [options]');
console.log();

console.log(bold('Commands:'));
console.log(`  ${green('start')}     Start the application`);
console.log(`  ${green('build')}     Build for production`);
console.log(`  ${green('test')}      Run tests`);
console.log();

console.log(bold('Options:'));
console.log(`  ${yellow('--help')}     Show help information`);
console.log(`  ${yellow('--version')}  Display version`);
```

### Error Messages

Make errors stand out:

```typescript
import { red, bold, yellow, dim } from '@visulima/colorize';

function showError(error) {
  console.log(red(bold('Error:')), error.message);
  console.log();
  console.log(yellow('Stack trace:'));
  console.log(dim(error.stack));
}

try {
  throw new Error('Something went wrong');
} catch (error) {
  showError(error);
}
```

### Progress Indicators

Create visual progress indicators:

```typescript
import { green, yellow, gray } from '@visulima/colorize';

function showProgress(current, total) {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((barLength * current) / total);
  const empty = barLength - filled;
  
  const bar = green('█'.repeat(filled)) + gray('░'.repeat(empty));
  
  console.log(`Progress: [${bar}] ${percentage}%`);
}

// Simulate progress
for (let i = 0; i <= 100; i += 10) {
  showProgress(i, 100);
}
```

## Combining Colors and Styles

### Chaining

Chain multiple styles together:

```typescript
import { red, bold, underline, italic } from '@visulima/colorize';

// Multiple styles
console.log(red.bold('Bold and red'));
console.log(red.bold.underline('Bold, red, and underlined'));

// Many styles chained
console.log(red.bold.italic.underline('All the styles!'));
```

### Background Colors

Add background colors to text:

```typescript
import { white, bgRed, bgGreen, bgYellow } from '@visulima/colorize';

console.log(white.bgRed(' ERROR '));
console.log(white.bgGreen(' SUCCESS '));
console.log(white.bgYellow(' WARNING '));
```

### Nested Styles

Nest different styles within each other:

```typescript
import { red, blue, green, bold } from '@visulima/colorize';

console.log(red`Error: The file ${blue.bold('config.json')} was not found`);
console.log(green`Status: ${bold('OK')} - ${blue('3 tests passed')}`);
```

## Working with Variables

### Dynamic Content

Apply colors to variables:

```typescript
import { red, green } from '@visulima/colorize';

const status = 'failed';
const count = 5;

console.log(red(status));
console.log(`Found ${red(count)} errors`);

// With template literals
console.log(red`Status: ${status}`);
console.log(`Found ${red`${count}`} errors`);
```

### Conditional Coloring

Apply colors based on conditions:

```typescript
import { red, green, yellow } from '@visulima/colorize';

function colorStatus(status) {
  const colors = {
    success: green,
    error: red,
    warning: yellow,
  };
  
  const colorFn = colors[status] || (text => text);
  return colorFn(status);
}

console.log(colorStatus('success'));
console.log(colorStatus('error'));
console.log(colorStatus('warning'));
```

## Text Formatting

### Text Styles

Apply various text decorations:

```typescript
import { bold, dim, italic, underline, strikethrough } from '@visulima/colorize';

console.log(bold('Bold text'));
console.log(dim('Dim text'));
console.log(italic('Italic text'));
console.log(underline('Underlined text'));
console.log(strikethrough('Strikethrough text'));
```

### Combining Formatting

Mix colors with text formatting:

```typescript
import { red, blue, bold, italic } from '@visulima/colorize';

console.log(red.bold('Bold red text'));
console.log(blue.italic('Italic blue text'));
console.log(red.bold.italic('Bold italic red text'));
```

## TrueColor Support

### Hex Colors

Use hex color codes:

```typescript
import { hex } from '@visulima/colorize';

console.log(hex('#FF0000')('Red using hex'));
console.log(hex('#00FF00')('Green using hex'));
console.log(hex('#0000FF')('Blue using hex'));

// Short form
console.log(hex('#F00')('Red (short form)'));
console.log(hex('#0F0')('Green (short form)'));
```

### RGB Colors

Use RGB values:

```typescript
import { rgb } from '@visulima/colorize';

console.log(rgb(255, 0, 0)('Red using RGB'));
console.log(rgb(0, 255, 0)('Green using RGB'));
console.log(rgb(0, 0, 255)('Blue using RGB'));
```

### Background Colors

Apply colors to backgrounds:

```typescript
import { bgHex, bgRgb, black } from '@visulima/colorize';

console.log(black.bgHex('#FF69B4')('Hot pink background'));
console.log(black.bgRgb(255, 182, 193)('Light pink background'));
```

## Removing Colors

### Stripping ANSI Codes

Remove color codes from strings:

```typescript
import colorize, { red, strip } from '@visulima/colorize';

const styledText = red.bold('Error message');
const plainText = strip(styledText);

console.log(styledText);  // Colored output
console.log(plainText);   // 'Error message' (no colors)

// Using default import
const styled = colorize.red('Error');
const plain = colorize.strip(styled);
```

This is useful for:
- Logging to files
- Testing output
- Calculating string length
- Processing text

## Best Practices

### Use Named Imports

Named imports provide better tree-shaking and clearer dependencies:

```typescript
// Good
import { red, green, bold } from '@visulima/colorize';

// Less optimal
import colorize from '@visulima/colorize';
```

### Create Reusable Helpers

Define color schemes once:

```typescript
import { red, yellow, blue, bold } from '@visulima/colorize';

const styles = {
  error: red.bold,
  warning: yellow,
  info: blue,
  success: green.bold,
};

console.log(styles.error('Error message'));
console.log(styles.info('Information'));
```

### Respect User Preferences

Check for color support and respect `NO_COLOR`:

```typescript
import colorize, { red } from '@visulima/colorize';

// Colorize automatically detects color support
// It respects NO_COLOR and other environment variables
console.log(red('This respects user preferences'));
```

### Keep It Readable

Don't overuse colors:

```typescript
// Good - clear hierarchy
console.log(red('Error:'), 'Connection failed');

// Bad - too many colors
console.log(red`Error: The ${blue`connection`} to ${green`server`} ${yellow`failed`}`);
```

## Common Patterns

### Table Headers

```typescript
import { bold, cyan } from '@visulima/colorize';

console.log(bold(cyan('Name')).padEnd(20), 
            bold(cyan('Status')).padEnd(15), 
            bold(cyan('Time')));
```

### Diff Output

```typescript
import { green, red } from '@visulima/colorize';

console.log(green('+ Added line'));
console.log(red('- Removed line'));
console.log('  Unchanged line');
```

### Badges

```typescript
import { black, bgGreen, bgRed, bgYellow } from '@visulima/colorize';

console.log(black.bgGreen(' PASS '), 'All tests passed');
console.log(black.bgRed(' FAIL '), 'Tests failed');
console.log(black.bgYellow(' WARN '), 'Warning message');
```

## What's Next?

Now that you understand the basics, explore:

- [API Reference](./api-reference.md) - Complete function and color reference
- [Examples](./examples.md) - More real-world examples
- [Advanced Features](./advanced.md) - Gradients, templates, and advanced usage
- [Browser Usage](./browser.md) - Using Colorize in web browsers

## Need Help?

- Check the [FAQ](./faq.md) for common questions
- Review the [Troubleshooting](./troubleshooting.md) guide
- Report issues on [GitHub](https://github.com/visulima/visulima/issues)
