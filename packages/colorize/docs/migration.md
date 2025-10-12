# Migration Guide

Guide for migrating from other terminal styling libraries to `@visulima/colorize`.

## Table of Contents

- [From Chalk](#from-chalk)
- [From Kleur](#from-kleur)
- [From Colorette](#from-colorette)
- [From Ansi-Colors](#from-ansi-colors)
- [From Colors.js](#from-colorsjs)
- [Migration Checklist](#migration-checklist)

## From Chalk

Colorize is designed to be compatible with Chalk's API. In most cases, you can simply replace the import and your code will work.

### Basic Replacement

```diff
- import chalk from 'chalk';
+ import chalk from '@visulima/colorize';

chalk.red('Error message');
chalk.green.bold('Success!');
```

Or use named imports (recommended):

```diff
- import chalk from 'chalk';
+ import { red, green, bold } from '@visulima/colorize';

- chalk.red('Error message');
+ red('Error message');

- chalk.green.bold('Success!');
+ green.bold('Success!');
```

### API Compatibility

Colorize supports all standard Chalk APIs:

```typescript
// All of these work the same
import colorize, { red, green, blue } from '@visulima/colorize';

// Function calls
colorize.red('text');
red('text');

// Template literals
colorize.red`text`;
red`text`;

// Chaining
colorize.red.bold('text');
red.bold('text');

// Nesting
colorize.red(`Error: ${colorize.blue('details')}`);
red`Error: ${blue('details')}`;

// TrueColor
colorize.hex('#FF0000')('text');
hex('#FF0000')('text');

// RGB
colorize.rgb(255, 0, 0)('text');
rgb(255, 0, 0)('text');

// ANSI 256
colorize.ansi256(196)('text');
ansi256(196)('text');
```

### Features Available in Colorize

Additional features not in Chalk:

```typescript
import { gradient, multilineGradient } from '@visulima/colorize/gradient';
import template from '@visulima/colorize/template';

// Gradients (not in Chalk)
console.log(gradient('red', 'blue')('Gradient text'));

// Enhanced template literals (separate in Chalk)
console.log(template`{red Error:} {blue Details}`);
```

### Breaking Changes

**None for standard usage.** Colorize is designed to be a drop-in replacement.

### Performance Benefits

Colorize is faster than Chalk:

```typescript
// Same code, better performance
import { red } from '@visulima/colorize';

for (let i = 0; i < 10000; i++) {
  red('text'); // Up to 3x faster than Chalk
}
```

### Migration Steps

1. Install Colorize:
   ```bash
   npm uninstall chalk
   npm install @visulima/colorize
   ```

2. Update imports:
   ```diff
   - import chalk from 'chalk';
   + import chalk from '@visulima/colorize';
   ```

3. Or use named imports:
   ```diff
   - import chalk from 'chalk';
   + import { red, green, blue, bold } from '@visulima/colorize';
   
   - chalk.red('text')
   + red('text')
   ```

4. Test your application
5. Enjoy better performance!

## From Kleur

Kleur uses a similar chaining API. Migration is straightforward.

### Basic Replacement

```diff
- import kleur from 'kleur';
+ import colorize from '@visulima/colorize';

- kleur.red('text');
+ colorize.red('text');

- kleur.red().bold('text');
+ colorize.red.bold('text');
```

With named imports:

```diff
- import { red, green } from 'kleur';
+ import { red, green } from '@visulima/colorize';

red('text'); // Same API
green('text'); // Same API
```

### API Differences

**Kleur:**
```typescript
import { red } from 'kleur';

red().bold('text'); // Note the parentheses
red('text');
```

**Colorize:**
```typescript
import { red } from '@visulima/colorize';

red.bold('text'); // No parentheses needed
red('text');
red`text`; // Template literals also work
```

### Additional Features in Colorize

```typescript
import { hex, rgb, gradient } from '@visulima/colorize';

// TrueColor support (limited in Kleur)
hex('#FF0000')('text');
rgb(255, 0, 0)('text');

// Gradients (not in Kleur)
gradient('red', 'blue')('text');

// Nested templates (not in Kleur)
red`Error ${blue`details`}`;
```

### Migration Steps

1. Install Colorize:
   ```bash
   npm uninstall kleur
   npm install @visulima/colorize
   ```

2. Update imports and remove parentheses:
   ```diff
   - import { red, green } from 'kleur';
   + import { red, green } from '@visulima/colorize';
   
   - red().bold('text')
   + red.bold('text')
   ```

3. Test your application

## From Colorette

Colorette has a minimal API. Colorize provides the same functions plus more.

### Basic Replacement

```diff
- import { red, green, bold } from 'colorette';
+ import { red, green, bold } from '@visulima/colorize';

red('text'); // Same
green('text'); // Same
bold('text'); // Same
```

### API Differences

**Colorette:**
```typescript
import { red, bold } from 'colorette';

// Only function calls
red('text');
bold(red('text')); // Nested with function calls
```

**Colorize:**
```typescript
import { red, bold } from '@visulima/colorize';

// Function calls
red('text');

// Template literals
red`text`;

// Chaining
red.bold('text');

// Nested templates
red`Error ${bold('details')}`;
```

### Additional Features in Colorize

```typescript
// TrueColor (not in Colorette)
import { hex, rgb } from '@visulima/colorize';
hex('#FF0000')('text');
rgb(255, 0, 0)('text');

// ANSI 256 (not in Colorette)
import { ansi256 } from '@visulima/colorize';
ansi256(196)('text');

// Gradients (not in Colorette)
import { gradient } from '@visulima/colorize/gradient';
gradient('red', 'blue')('text');
```

### Migration Steps

1. Install Colorize:
   ```bash
   npm uninstall colorette
   npm install @visulima/colorize
   ```

2. Update imports (same names):
   ```diff
   - import { red, green } from 'colorette';
   + import { red, green } from '@visulima/colorize';
   ```

3. Optionally improve with chaining:
   ```diff
   - bold(red('text'))
   + red.bold('text')
   ```

4. Test your application

## From Ansi-Colors

Ansi-colors uses a default import style. Easy to migrate.

### Basic Replacement

```diff
- const c = require('ansi-colors');
+ const c = require('@visulima/colorize');

c.red('text'); // Same API
c.bold.red('text'); // Same API
```

Or with ESM:

```diff
- import c from 'ansi-colors';
+ import c from '@visulima/colorize';
```

### API Compatibility

Most APIs are compatible:

```typescript
import colorize from '@visulima/colorize';

colorize.red('text');
colorize.bold.red('text');
colorize.red.bold.underline('text');
```

### Additional Features in Colorize

```typescript
import { hex, rgb, gradient } from '@visulima/colorize';

// Template literals (limited in ansi-colors)
red`text`;

// TrueColor
hex('#FF0000')('text');

// Gradients
gradient('red', 'blue')('text');

// Better nesting
red`Error ${blue`details`}`;
```

### Migration Steps

1. Install Colorize:
   ```bash
   npm uninstall ansi-colors
   npm install @visulima/colorize
   ```

2. Update imports (minimal changes needed):
   ```diff
   - import c from 'ansi-colors';
   + import c from '@visulima/colorize';
   ```

3. Test your application

## From Colors.js

Colors.js has a unique API that extends String.prototype. Colorize uses a different approach.

### API Differences

**Colors.js:**
```javascript
require('colors');

console.log('text'.red);
console.log('text'.red.bold);
```

**Colorize:**
```typescript
import { red, bold } from '@visulima/colorize';

console.log(red('text'));
console.log(red.bold('text'));
```

### Migration Required

Colors.js extends String.prototype, which Colorize explicitly avoids. You'll need to update your code:

```diff
- require('colors');
+ import { red, green, bold, underline } from '@visulima/colorize';

- console.log('text'.red);
+ console.log(red('text'));

- console.log('text'.red.bold);
+ console.log(red.bold('text'));

- console.log('text'.underline.red);
+ console.log(red.underline('text'));
```

### Color Name Mapping

Most colors have the same names:

| Colors.js | Colorize |
|-----------|----------|
| `.red` | `red()` |
| `.green` | `green()` |
| `.blue` | `blue()` |
| `.yellow` | `yellow()` |
| `.bold` | `bold()` |
| `.italic` | `italic()` |
| `.underline` | `underline()` |

### Benefits of Migration

1. **No prototype pollution**: Safer code
2. **Better TypeScript support**: Full type safety
3. **Faster performance**: Optimized implementation
4. **More features**: Gradients, TrueColor, better nesting

### Migration Steps

1. Install Colorize:
   ```bash
   npm uninstall colors
   npm install @visulima/colorize
   ```

2. Remove Colors.js require:
   ```diff
   - require('colors');
   ```

3. Add Colorize imports:
   ```diff
   + import { red, green, bold } from '@visulima/colorize';
   ```

4. Update all styled strings:
   ```diff
   - 'text'.red
   + red('text')
   
   - 'text'.red.bold
   + red.bold('text')
   ```

5. Search and replace (regex):
   ```
   Find: '([^']+)'\.(\w+)
   Replace: $2('$1')
   ```

6. Test thoroughly

## Migration Checklist

Use this checklist to ensure a smooth migration:

### Pre-Migration

- [ ] Identify all color/style usage in codebase
- [ ] Check for custom colors or themes
- [ ] Review environment variable usage
- [ ] Backup your code
- [ ] Create a test branch

### During Migration

- [ ] Install @visulima/colorize
- [ ] Update all imports
- [ ] Convert API calls
- [ ] Update custom wrappers/helpers
- [ ] Run tests
- [ ] Check console output manually

### Post-Migration

- [ ] Verify all colors render correctly
- [ ] Test on different terminals
- [ ] Check CI/CD output
- [ ] Update documentation
- [ ] Remove old dependency
- [ ] Deploy to staging
- [ ] Monitor for issues

## Common Migration Patterns

### Pattern 1: Wrapper Function

**Before (any library):**
```typescript
import chalk from 'chalk';

function logError(message: string) {
  console.error(chalk.red.bold(message));
}
```

**After:**
```typescript
import { red, bold } from '@visulima/colorize';

function logError(message: string) {
  console.error(red.bold(message));
}
```

### Pattern 2: Theme Object

**Before:**
```typescript
import chalk from 'chalk';

const theme = {
  error: chalk.red.bold,
  success: chalk.green,
  warning: chalk.yellow,
};
```

**After:**
```typescript
import { red, green, yellow, bold } from '@visulima/colorize';

const theme = {
  error: red.bold,
  success: green,
  warning: yellow,
};
```

### Pattern 3: Conditional Coloring

**Before:**
```typescript
import chalk from 'chalk';

const color = success ? chalk.green : chalk.red;
console.log(color('Message'));
```

**After:**
```typescript
import { green, red } from '@visulima/colorize';

const color = success ? green : red;
console.log(color('Message'));
```

## Troubleshooting

### Colors Not Showing

Check environment variables:
```typescript
// May need to set:
process.env.FORCE_COLOR = '1';
```

### Different Output

Compare output:
```typescript
import { strip } from '@visulima/colorize';

const output = red('text');
console.log(strip(output)); // Check plain text
```

### Performance Issues

Colorize should be faster. If not:
- Check for unnecessary re-renders
- Cache styled strings
- Use named imports

## Need Help?

- Check the [FAQ](./faq.md)
- Review [Troubleshooting](./troubleshooting.md)
- Report issues on [GitHub](https://github.com/visulima/visulima/issues)
- See [API Reference](./api-reference.md) for complete documentation

## Summary

Migrating to Colorize is straightforward:

1. **From Chalk**: Drop-in replacement, zero changes needed
2. **From Kleur**: Remove parentheses in chaining
3. **From Colorette**: Same API, more features available
4. **From Ansi-Colors**: Compatible API
5. **From Colors.js**: Requires code updates (no String.prototype)

Benefits after migration:
- Better performance (up to 3x faster)
- More features (gradients, better templates)
- Better TypeScript support
- Active maintenance
- Modern codebase
