# Frequently Asked Questions

Common questions and answers about `@visulima/colorize`.

## General Questions

### What is Colorize?

Colorize is a modern terminal and console styling library for Node.js and browsers. It provides an intuitive API for adding colors and styles to your terminal output.

### Why should I use Colorize over alternatives?

- **Performance**: Up to 3x faster than Chalk
- **Compatibility**: Drop-in replacement for Chalk
- **Features**: Gradients, enhanced templates, nested styles
- **Modern**: Full ESM and TypeScript support
- **Cross-platform**: Works in Node.js, Deno, browsers, and Next.js

### Is Colorize actively maintained?

Yes, Colorize is part of the Visulima monorepo and actively maintained.

### Is Colorize production-ready?

Yes, Colorize is stable and used in production applications.

## Installation & Setup

### How do I install Colorize?

```bash
npm install @visulima/colorize
# or
yarn add @visulima/colorize
# or
pnpm add @visulima/colorize
```

### Does Colorize work with TypeScript?

Yes, Colorize includes full TypeScript definitions out of the box. No additional `@types` packages needed.

### Can I use Colorize with CommonJS?

Yes, Colorize supports both ESM and CommonJS:

```javascript
// ESM
import { red } from '@visulima/colorize';

// CommonJS
const { red } = require('@visulima/colorize');
```

### What Node.js versions are supported?

Node.js 18.x and above.

## Usage Questions

### How do I apply colors to text?

```typescript
import { red, green, blue } from '@visulima/colorize';

console.log(red('Red text'));
console.log(green`Green text`);
console.log(blue.bold('Bold blue'));
```

### Can I chain multiple styles?

Yes:

```typescript
import { red, bold, underline } from '@visulima/colorize';

console.log(red.bold.underline('All styles combined'));
```

### How do I nest styled text?

```typescript
import { red, blue } from '@visulima/colorize';

console.log(red`Error: ${blue`file.js`} not found`);
```

### What's the difference between function calls and template literals?

Both work the same way:

```typescript
import { red } from '@visulima/colorize';

red('text');    // Function call
red`text`;      // Template literal

// Both produce identical output
```

Template literals are cleaner for complex strings:

```typescript
// Cleaner with template literal
red`Error: ${fileName} not found`;

// More verbose with function
red('Error: ' + fileName + ' not found');
```

### How do I use hex colors?

```typescript
import { hex } from '@visulima/colorize';

console.log(hex('#FF0000')('Red'));
console.log(hex('#F00')('Red')); // Short form
console.log(hex('FF0000')('Red')); // Without #
```

### How do I use RGB colors?

```typescript
import { rgb } from '@visulima/colorize';

console.log(rgb(255, 0, 0)('Red'));
console.log(rgb(0, 255, 0)('Green'));
```

### Can I use custom colors?

Yes, use `hex()` or `rgb()`:

```typescript
import { hex } from '@visulima/colorize';

const brandColor = hex('#007bff');
console.log(brandColor('Brand colored text'));
```

### How do I create gradients?

```typescript
import { gradient } from '@visulima/colorize/gradient';

console.log(gradient('red', 'blue')('Gradient text'));
console.log(gradient(['red', 'yellow', 'green'])('Rainbow'));
```

## Color Support

### Why aren't colors showing in my terminal?

Check:
1. Your terminal supports colors
2. `NO_COLOR` is not set: `echo $NO_COLOR`
3. Output is TTY: `node -p "process.stdout.isTTY"`
4. Try forcing colors: `FORCE_COLOR=1 node app.js`

### How do I force colors in CI?

```bash
FORCE_COLOR=3 npm test
```

Or in CI configuration:
```yaml
env:
  FORCE_COLOR: 3
```

### How do I disable colors?

```bash
# Environment variable
NO_COLOR=1 node app.js

# CLI flag
node app.js --no-color
```

### Does Colorize work over SSH?

Yes, but you may need to force colors:

```bash
ssh user@server "FORCE_COLOR=1 node app.js"
```

### Does Colorize work in Docker?

Yes, use `FORCE_COLOR` in your Dockerfile or docker-compose:

```dockerfile
ENV FORCE_COLOR=3
```

## Browser Questions

### Can I use Colorize in the browser?

Yes:

```typescript
import { red, green } from '@visulima/colorize/browser';

console.log(...red('Error')); // Note the spread operator
```

### Why do I need the spread operator in browsers?

Browser consoles use a different API (`%c` syntax). The spread operator unpacks the array:

```typescript
// Returns: ['%cText', 'color: red']
const styled = red('Text');

// Must spread into console.log
console.log(...styled);
```

### Does Colorize work in all browsers?

Yes, modern browsers support console styling:
- Chrome 69+
- Firefox 31+
- Safari 6.1+
- Edge 79+

## Migration Questions

### Can I switch from Chalk to Colorize?

Yes, Colorize is a drop-in replacement:

```diff
- import chalk from 'chalk';
+ import chalk from '@visulima/colorize';

// All code works the same
```

### Do I need to change my code when migrating from Chalk?

No, the API is 100% compatible for standard usage.

### How do I migrate from Kleur?

Remove parentheses from chaining:

```diff
- kleur.red().bold('text')
+ colorize.red.bold('text')
```

### Is the migration worth it?

Benefits:
- Better performance (up to 3x faster)
- More features (gradients, enhanced templates)
- Better TypeScript support
- Active maintenance

## Performance Questions

### Is Colorize faster than Chalk?

Yes, benchmarks show Colorize is up to 3x faster than Chalk.

### Does Colorize affect application startup time?

No, Colorize is lightweight and has minimal impact on startup.

### Should I cache styled strings?

For frequently used strings, yes:

```typescript
const ERROR_PREFIX = red.bold('[ERROR]');

// Reuse
console.log(ERROR_PREFIX, 'Message 1');
console.log(ERROR_PREFIX, 'Message 2');
```

## Troubleshooting

### Colors show up in my log files

Disable colors when writing to files:

```bash
NO_COLOR=1 node app.js > output.log
```

Or strip colors in code:

```typescript
import { strip } from '@visulima/colorize';

const styled = red('Error');
const plain = strip(styled);
fs.writeFileSync('log.txt', plain);
```

### Wrong colors are showing

Check your terminal's color support:

```bash
echo $TERM
echo $COLORTERM
```

Force specific color depth:

```bash
FORCE_COLOR=1 node app.js  # 16 colors
FORCE_COLOR=2 node app.js  # 256 colors
FORCE_COLOR=3 node app.js  # TrueColor
```

### Styles not appearing

Some terminals don't support all styles:
- Italic may not work in some terminals
- Strikethrough support varies
- Underline works in most terminals

### Import errors in TypeScript

Ensure your `tsconfig.json` is configured:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

### Getting type errors

Make sure you're using TypeScript 4.5+:

```bash
npm install -D typescript@latest
```

## Advanced Questions

### Can I create custom color palettes?

Yes:

```typescript
import { hex } from '@visulima/colorize';

const theme = {
  primary: hex('#007bff'),
  success: hex('#28a745'),
  danger: hex('#dc3545'),
};

console.log(theme.primary('Primary text'));
```

### How do I handle dynamic colors?

```typescript
import { hex } from '@visulima/colorize';

function getColor(level: number) {
  if (level > 80) return hex('#ff0000');
  if (level > 50) return hex('#ffff00');
  return hex('#00ff00');
}

const level = 75;
console.log(getColor(level)(`Level: ${level}%`));
```

### Can I disable colors programmatically?

While not recommended (respect user preferences), you can:

```typescript
process.env.NO_COLOR = '1';

import { red } from '@visulima/colorize';
// Colors will be disabled
```

### How do I test colored output?

Use `strip()` to test plain text:

```typescript
import { strip, red } from '@visulima/colorize';

const output = red('Error');
expect(strip(output)).toBe('Error');
```

### Can I use Colorize in a library?

Yes, but respect user preferences:

```typescript
import { red, green } from '@visulima/colorize';

// Let Colorize handle color detection
export function logError(message: string) {
  console.error(red(message));
}
```

### How do I create multiline colored text?

```typescript
import { red } from '@visulima/colorize';

console.log(red(`
Line 1
Line 2
Line 3
`));
```

### Can I use ANSI escape codes directly?

Yes, through `open` and `close` properties:

```typescript
import { red } from '@visulima/colorize';

console.log(`${red.open}Text${red.close}`);
```

### Does Colorize work with Winston/Pino loggers?

Yes, Colorize can be used with any logger:

```typescript
import winston from 'winston';
import { red, green } from '@visulima/colorize';

const logger = winston.createLogger({
  format: winston.format.printf(info => {
    const level = info.level === 'error' ? red(info.level) : green(info.level);
    return `${level}: ${info.message}`;
  }),
  transports: [new winston.transports.Console()],
});
```

### Can I use Colorize with Commander.js?

Yes:

```typescript
import { Command } from 'commander';
import { red, green, yellow } from '@visulima/colorize';

const program = new Command();

program
  .name('my-cli')
  .description(green('My awesome CLI tool'))
  .version('1.0.0');

program
  .command('init')
  .description(yellow('Initialize project'))
  .action(() => {
    console.log(green('Initializing...'));
  });

program.parse();
```

## Package Questions

### What's the bundle size?

Colorize is lightweight. Check the exact size on [bundlephobia](https://bundlephobia.com/package/@visulima/colorize).

### Does Colorize have dependencies?

Only one: `@visulima/is-ansi-color-supported` for color detection.

### Can I use Colorize in Deno?

Yes:

```typescript
import { red } from "npm:@visulima/colorize";

console.log(red("Hello from Deno!"));
```

### Does Colorize work with Bun?

Yes, Colorize works with Bun:

```bash
bun add @visulima/colorize
```

### Is Colorize tree-shakeable?

Yes, when using named imports with modern bundlers.

## Support

### Where can I report bugs?

[GitHub Issues](https://github.com/visulima/visulima/issues)

### How do I request features?

Open a [GitHub Issue](https://github.com/visulima/visulima/issues) with the feature request label.

### Where can I find more examples?

Check the [Examples](./examples.md) documentation.

### Is there a Discord/Slack?

Check the [main repository](https://github.com/visulima/visulima) for community links.

### How can I contribute?

See the [Contributing Guide](https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md).

## Related Documentation

- [Getting Started](./getting-started.md) - Basic usage
- [API Reference](./api-reference.md) - Complete API
- [Examples](./examples.md) - Practical examples
- [Troubleshooting](./troubleshooting.md) - Common issues
- [Migration Guide](./migration.md) - Migrating from other libraries
