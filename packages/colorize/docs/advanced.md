# Advanced Features

Advanced features and techniques for `@visulima/colorize`.

## Table of Contents

- [Gradients](#gradients)
- [Tagged Template Literals](#tagged-template-literals)
- [Custom Color Palettes](#custom-color-palettes)
- [Performance Optimization](#performance-optimization)
- [Dynamic Styling](#dynamic-styling)
- [ANSI Code Manipulation](#ansi-code-manipulation)

## Gradients

Colorize includes powerful gradient functionality for creating beautiful color transitions.

### Basic Gradients

Create simple color gradients:

```typescript
import { gradient } from '@visulima/colorize/gradient';

// Two-color gradient
console.log(gradient('red', 'blue')('Hello World!'));

// Three-color gradient
console.log(gradient('red', 'yellow', 'green')('Rainbow text'));

// Using hex colors
console.log(gradient('#FF0000', '#00FF00', '#0000FF')('RGB gradient'));
```

### Gradient with Options

Customize gradient behavior:

```typescript
import { gradient } from '@visulima/colorize/gradient';

// HSV interpolation
console.log(
  gradient(['red', 'blue'], { interpolation: 'hsv' })('Smooth transition')
);

// Long HSV spin
console.log(
  gradient(['red', 'blue'], { interpolation: 'hsv', hsvSpin: 'long' })('Long spin')
);

// RGB interpolation (default)
console.log(
  gradient(['red', 'blue'], { interpolation: 'rgb' })('RGB transition')
);
```

**Available Options:**
- `interpolation`: `'rgb'` or `'hsv'` (default: `'rgb'`)
- `hsvSpin`: `'short'` or `'long'` (default: `'short'`)

### Multiline Gradients

Apply consistent gradients across multiple lines:

```typescript
import { multilineGradient } from '@visulima/colorize/gradient';

const asciiArt = [
  '     __     ',
  '   <(o )___ ',
  '    ( ._> / ',
  "     `---'  "
].join('\n');

console.log(multilineGradient(['orange', 'yellow'])(asciiArt));
```

The gradient is applied horizontally across all lines, maintaining color consistency vertically.

### Complex Gradient Examples

#### Rainbow Effect

```typescript
import { gradient } from '@visulima/colorize/gradient';

const rainbowColors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];

console.log(gradient(rainbowColors)('Rainbow colored text!'));
```

#### Sunset Effect

```typescript
import { gradient } from '@visulima/colorize/gradient';

const text = '='.repeat(50);
console.log(gradient(['#FF6B6B', '#FFA07A', '#FFD700'])(text));
```

#### Neon Effect

```typescript
import { gradient } from '@visulima/colorize/gradient';

const neonColors = ['#39FF14', '#00FFFF', '#FF10F0'];
console.log(gradient(neonColors, { interpolation: 'hsv' })('NEON LIGHTS'));
```

### Predefined Gradient Themes

Create reusable gradient themes:

```typescript
import { gradient } from '@visulima/colorize/gradient';

const themes = {
  fire: gradient(['#ff0000', '#ff7f00', '#ffff00']),
  ocean: gradient(['#006994', '#0099cc', '#66ccff']),
  forest: gradient(['#0f5132', '#198754', '#20c997']),
  sunset: gradient(['#ff6b6b', '#ffa07a', '#ffd700']),
  purple: gradient(['#4b0082', '#9370db', '#da70d6']),
  cyberpunk: gradient(['#ff00ff', '#00ffff', '#ffff00'], { interpolation: 'hsv' }),
};

console.log(themes.fire('Fire effect!'));
console.log(themes.ocean('Ocean wave'));
console.log(themes.forest('Forest green'));
console.log(themes.sunset('Sunset colors'));
console.log(themes.purple('Purple haze'));
console.log(themes.cyberpunk('Cyberpunk 2077'));
```

### ASCII Art with Gradients

Combine gradients with ASCII art:

```typescript
import { multilineGradient, gradient } from '@visulima/colorize/gradient';

const logo = `
 ███╗   ███╗██╗   ██╗     █████╗ ██████╗ ██████╗ 
 ████╗ ████║╚██╗ ██╔╝    ██╔══██╗██╔══██╗██╔══██╗
 ██╔████╔██║ ╚████╔╝     ███████║██████╔╝██████╔╝
 ██║╚██╔╝██║  ╚██╔╝      ██╔══██║██╔═══╝ ██╔═══╝ 
 ██║ ╚═╝ ██║   ██║       ██║  ██║██║     ██║     
 ╚═╝     ╚═╝   ╚═╝       ╚═╝  ╚═╝╚═╝     ╚═╝     
`;

console.log(multilineGradient(['#ff0080', '#ff8c00', '#40e0d0'])(logo));

// Add separator with matching gradient
console.log(gradient(['#ff0080', '#ff8c00', '#40e0d0'])('─'.repeat(50)));
```

## Tagged Template Literals

Use template strings with dynamic styling.

### Basic Template Usage

```typescript
import template from '@visulima/colorize/template';

const cpu = { totalPercent: 45 };
const ram = { used: 8, total: 16 };
const disk = { used: 250, total: 500 };

console.log(template`
CPU:  {red ${cpu.totalPercent}%}
RAM:  {green ${(ram.used / ram.total) * 100}%}
DISK: {blue ${(disk.used / disk.total) * 100}%}
`);
```

### Chained Styles

Chain multiple styles in templates:

```typescript
import template from '@visulima/colorize/template';

console.log(template`
{bold.red Error:} Connection failed
{bold.green Success:} Operation completed
{bold.yellow Warning:} Deprecated API
{bold.blue.underline https://example.com}
`);
```

### Color Functions in Templates

Use color functions within templates:

```typescript
import template from '@visulima/colorize/template';

console.log(template`
{rgb(255,0,0) Red using RGB}
{hex(#00FF00) Green using hex}
{ansi256(51) Cyan using ANSI 256}
`);
```

### Shorthand Hex Notation

Use shorthand hex colors in templates:

```typescript
import template from '@visulima/colorize/template';

console.log(template`
{#FF0000 Foreground red}
{#:00FF00 Background green}
{#FFFF00:#0000FF Yellow on blue}
`);
```

### Dynamic Templates

Create reusable template functions:

```typescript
import template from '@visulima/colorize/template';

function createStatusMessage(service: string, status: 'up' | 'down', uptime: number) {
  const statusColor = status === 'up' ? 'green' : 'red';
  const statusText = status === 'up' ? '✓ Online' : '✗ Offline';
  
  return template`
Service: {bold.cyan ${service}}
Status:  {bold.${statusColor} ${statusText}}
Uptime:  {gray ${uptime}s}
  `;
}

console.log(createStatusMessage('API Server', 'up', 86400));
console.log(createStatusMessage('Database', 'down', 0));
```

### Complex Template Patterns

Build complex formatted output:

```typescript
import template from '@visulima/colorize/template';

interface BuildInfo {
  name: string;
  version: string;
  status: 'success' | 'failed' | 'pending';
  duration: number;
  files: number;
}

function formatBuildInfo(build: BuildInfo) {
  const statusColors = {
    success: 'green',
    failed: 'red',
    pending: 'yellow'
  };
  
  const statusIcons = {
    success: '✓',
    failed: '✗',
    pending: '○'
  };

  return template`
{bold.cyan ${build.name}} {gray v${build.version}}
{bold.${statusColors[build.status]} ${statusIcons[build.status]} ${build.status.toUpperCase()}}
{gray Duration: ${build.duration}ms}
{gray Files: ${build.files}}
  `;
}

console.log(formatBuildInfo({
  name: 'web-app',
  version: '1.2.3',
  status: 'success',
  duration: 2345,
  files: 42
}));
```

## Custom Color Palettes

Create consistent color schemes for your application.

### Defining a Palette

```typescript
import { hex, rgb, bold, italic } from '@visulima/colorize';

const palette = {
  // Brand colors
  primary: hex('#007bff'),
  secondary: hex('#6c757d'),
  success: hex('#28a745'),
  danger: hex('#dc3545'),
  warning: hex('#ffc107'),
  info: hex('#17a2b8'),
  
  // Grays
  dark: hex('#343a40'),
  light: hex('#f8f9fa'),
  
  // Status colors
  error: rgb(220, 53, 69),
  ok: rgb(40, 167, 69),
  
  // Text styles
  title: (text: string) => bold(palette.primary(text)),
  subtitle: (text: string) => italic(palette.secondary(text)),
  emphasis: (text: string) => bold(text),
};

// Usage
console.log(palette.title('Application Title'));
console.log(palette.subtitle('A brief description'));
console.log(palette.success('✓ Operation successful'));
console.log(palette.error('✗ Operation failed'));
```

### Theme System

Implement a complete theming system:

```typescript
import { hex, bold } from '@visulima/colorize';

interface Theme {
  primary: (text: string) => string;
  secondary: (text: string) => string;
  success: (text: string) => string;
  error: (text: string) => string;
  warning: (text: string) => string;
  muted: (text: string) => string;
}

const darkTheme: Theme = {
  primary: hex('#60a5fa'),
  secondary: hex('#a78bfa'),
  success: hex('#34d399'),
  error: hex('#f87171'),
  warning: hex('#fbbf24'),
  muted: hex('#6b7280'),
};

const lightTheme: Theme = {
  primary: hex('#2563eb'),
  secondary: hex('#7c3aed'),
  success: hex('#059669'),
  error: hex('#dc2626'),
  warning: hex('#d97706'),
  muted: hex('#9ca3af'),
};

// Theme selector
let currentTheme: Theme = darkTheme;

function setTheme(theme: 'dark' | 'light') {
  currentTheme = theme === 'dark' ? darkTheme : lightTheme;
}

// Usage with current theme
console.log(currentTheme.primary('Primary text'));
console.log(currentTheme.success('Success message'));
```

## Performance Optimization

### Caching Styled Strings

Cache frequently used styled strings:

```typescript
import { red, green, yellow, bold } from '@visulima/colorize';

class StyledCache {
  private cache = new Map<string, string>();

  get(key: string, generator: () => string): string {
    if (!this.cache.has(key)) {
      this.cache.set(key, generator());
    }
    return this.cache.get(key)!;
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new StyledCache();

// Cache styled strings
const errorPrefix = cache.get('error', () => red(bold('[ERROR]')));
const successPrefix = cache.get('success', () => green(bold('[SUCCESS]')));

// Reuse cached values
console.log(errorPrefix, 'Something went wrong');
console.log(successPrefix, 'Operation completed');
```

### Lazy Initialization

Delay style creation until needed:

```typescript
import type { ColorizeType } from '@visulima/colorize';

class LazyStyles {
  private _red?: ColorizeType['red'];
  private _green?: ColorizeType['green'];
  private _blue?: ColorizeType['blue'];

  get red() {
    if (!this._red) {
      this._red = require('@visulima/colorize').red;
    }
    return this._red;
  }

  get green() {
    if (!this._green) {
      this._green = require('@visulima/colorize').green;
    }
    return this._green;
  }

  get blue() {
    if (!this._blue) {
      this._blue = require('@visulima/colorize').blue;
    }
    return this._blue;
  }
}

const styles = new LazyStyles();
```

### Conditional Styling

Apply styles only when needed:

```typescript
import { red, green, strip } from '@visulima/colorize';

class ConditionalStyler {
  constructor(private enabled: boolean) {}

  style(text: string, styler: (text: string) => string): string {
    return this.enabled ? styler(text) : text;
  }
}

// Disable colors for file output
const fileStyler = new ConditionalStyler(false);
const consoleStyler = new ConditionalStyler(true);

const message = 'Status message';

// To file (no colors)
console.log(fileStyler.style(message, red));

// To console (with colors)
console.log(consoleStyler.style(message, green));
```

## Dynamic Styling

### Style Factory

Create styles dynamically based on conditions:

```typescript
import { red, yellow, green, blue, hex } from '@visulima/colorize';

function getStatusColor(percentage: number) {
  if (percentage >= 90) return green;
  if (percentage >= 70) return blue;
  if (percentage >= 50) return yellow;
  return red;
}

function displayMetric(name: string, value: number, max: number) {
  const percentage = (value / max) * 100;
  const color = getStatusColor(percentage);
  
  console.log(`${name}: ${color(`${percentage.toFixed(1)}%`)}`);
}

displayMetric('CPU', 45, 100);
displayMetric('Memory', 75, 100);
displayMetric('Disk', 95, 100);
```

### Data-Driven Styling

Apply styles based on data:

```typescript
import { hex } from '@visulima/colorize';

interface StyledValue {
  value: number;
  color?: string;
  threshold?: {
    low: number;
    medium: number;
    high: number;
  };
}

function styleValue(config: StyledValue): string {
  let color = config.color;

  if (!color && config.threshold) {
    if (config.value >= config.threshold.high) {
      color = '#ff0000';
    } else if (config.value >= config.threshold.medium) {
      color = '#ffff00';
    } else {
      color = '#00ff00';
    }
  }

  return color ? hex(color)(String(config.value)) : String(config.value);
}

console.log(styleValue({
  value: 85,
  threshold: { low: 30, medium: 60, high: 80 }
}));
```

### Rule-Based Styling

Apply styles based on rules:

```typescript
import { red, green, yellow, bold, italic } from '@visulima/colorize';

interface StyleRule {
  condition: (value: any) => boolean;
  style: (text: string) => string;
}

class RuleBasedStyler {
  private rules: StyleRule[] = [];

  addRule(condition: (value: any) => boolean, style: (text: string) => string) {
    this.rules.push({ condition, style });
    return this;
  }

  apply(value: any, text: string): string {
    for (const rule of this.rules) {
      if (rule.condition(value)) {
        return rule.style(text);
      }
    }
    return text;
  }
}

const styler = new RuleBasedStyler()
  .addRule((v) => v < 0, red.bold)
  .addRule((v) => v === 0, yellow)
  .addRule((v) => v > 0, green)
  .addRule((v) => v > 100, green.bold.italic);

console.log(styler.apply(-5, 'Negative'));
console.log(styler.apply(0, 'Zero'));
console.log(styler.apply(50, 'Positive'));
console.log(styler.apply(150, 'Very High'));
```

## ANSI Code Manipulation

### Direct ANSI Access

Access raw ANSI codes for advanced use cases:

```typescript
import { red, bold, blue } from '@visulima/colorize';

// Access opening and closing codes
console.log(`Text ${red.open}in red${red.close} back to normal`);

// Combine codes manually
console.log(`${red.open}${bold.open}Bold red${bold.close}${red.close}`);

// Build custom style
const customStyle = red.bold.underline;
console.log(`${customStyle.open}Custom${customStyle.close}`);
```

### Creating Custom Wrappers

Build custom wrapper functions:

```typescript
import { red, yellow, bold } from '@visulima/colorize';

function wrapInBox(text: string, color: (text: string) => string) {
  const width = text.length + 4;
  const top = color('┌' + '─'.repeat(width - 2) + '┐');
  const middle = color('│ ') + bold(text) + color(' │');
  const bottom = color('└' + '─'.repeat(width - 2) + '┘');
  
  return `${top}\n${middle}\n${bottom}`;
}

console.log(wrapInBox('Important Message', red));
console.log(wrapInBox('Warning Notice', yellow));
```

### Strip Specific Codes

Remove specific ANSI codes:

```typescript
import { strip } from '@visulima/colorize';

function stripButKeepBold(text: string): string {
  // This is a simplified example
  // In practice, you might need more sophisticated parsing
  const withoutColors = strip(text);
  // Keep bold codes if needed
  return withoutColors;
}
```

## Best Practices

### Composability

Build complex styles from simple ones:

```typescript
import { red, bold, underline } from '@visulima/colorize';

const error = red.bold;
const warning = yellow.bold;
const link = blue.underline;

// Compose styles
console.log(error('Error:'), 'Check', link('https://docs.example.com'));
```

### Consistency

Maintain consistent styling across your application:

```typescript
import { green, red, yellow, blue, bold } from '@visulima/colorize';

const LOG_STYLES = {
  ERROR: red.bold,
  WARN: yellow.bold,
  INFO: blue,
  SUCCESS: green.bold,
} as const;

function log(level: keyof typeof LOG_STYLES, message: string) {
  const style = LOG_STYLES[level];
  console.log(style(`[${level}]`), message);
}

log('ERROR', 'Something went wrong');
log('SUCCESS', 'Operation completed');
```

### Testability

Make styled output testable:

```typescript
import { strip, red } from '@visulima/colorize';

function getMessage(error: boolean): string {
  return error ? red('Error occurred') : 'Success';
}

// In tests
const output = getMessage(true);
expect(strip(output)).toBe('Error occurred');
```

## Related

- [Gradient Examples](./examples.md#gradients) - More gradient examples
- [Template Examples](./examples.md#templates) - Template usage examples
- [API Reference](./api-reference.md) - Complete API documentation
