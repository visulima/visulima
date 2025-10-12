# Troubleshooting

Solutions to common issues when using `@visulima/colorize`.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Colors Not Showing](#colors-not-showing)
- [Wrong Colors](#wrong-colors)
- [Import Errors](#import-errors)
- [TypeScript Issues](#typescript-issues)
- [Browser Issues](#browser-issues)
- [Performance Issues](#performance-issues)
- [CI/CD Issues](#cicd-issues)

## Installation Issues

### Package Not Found

**Problem:**
```
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@visulima/colorize
```

**Solutions:**

1. Check package name spelling:
   ```bash
   npm install @visulima/colorize
   ```

2. Clear npm cache:
   ```bash
   npm cache clean --force
   npm install @visulima/colorize
   ```

3. Check your npm registry:
   ```bash
   npm config get registry
   # Should be: https://registry.npmjs.org/
   ```

### Version Conflicts

**Problem:**
```
npm ERR! peer dep missing
```

**Solutions:**

1. Update dependencies:
   ```bash
   npm update
   ```

2. Clear node_modules:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Use correct Node.js version:
   ```bash
   node --version  # Should be 18.x or higher
   ```

## Colors Not Showing

### Issue: Plain Text Instead of Colors

**Problem:**
Colors don't appear in terminal output.

**Diagnosis:**

1. Check if output is TTY:
   ```bash
   node -e "console.log(process.stdout.isTTY)"
   # Should output: true
   ```

2. Check environment variables:
   ```bash
   echo $NO_COLOR      # Should be empty
   echo $TERM          # Should show terminal type
   echo $COLORTERM     # May show "truecolor"
   ```

3. Check CLI flags:
   ```bash
   # Don't use --no-color flag
   node app.js --no-color  # This disables colors
   ```

**Solutions:**

1. Force colors:
   ```bash
   FORCE_COLOR=1 node app.js
   ```

2. Remove NO_COLOR:
   ```bash
   unset NO_COLOR
   node app.js
   ```

3. Check terminal support:
   ```bash
   # Try different TERM values
   TERM=xterm-256color node app.js
   ```

4. Verify Colorize is working:
   ```typescript
   import { red } from '@visulima/colorize';
   console.log(red('Test')); // Should show red
   ```

### Issue: Colors Lost When Piping

**Problem:**
```bash
node app.js | less  # Colors disappear
```

**Solution:**

Force colors when piping:
```bash
FORCE_COLOR=1 node app.js | less -R
```

Or in code:
```typescript
process.env.FORCE_COLOR = '1';
import { red } from '@visulima/colorize';
```

### Issue: Colors in Log Files

**Problem:**
ANSI codes appear in log files instead of plain text.

**Solution:**

Disable colors for file output:
```bash
NO_COLOR=1 node app.js > output.log
```

Or strip colors in code:
```typescript
import { strip, red } from '@visulima/colorize';

const styled = red('Error');
const plain = strip(styled);

fs.writeFileSync('log.txt', plain);
```

## Wrong Colors

### Issue: Colors Look Different

**Problem:**
Colors don't match expected appearance.

**Diagnosis:**

1. Check color depth:
   ```bash
   echo $TERM
   echo $COLORTERM
   ```

2. Test color support:
   ```bash
   # Test different color depths
   FORCE_COLOR=1 node app.js  # 16 colors
   FORCE_COLOR=2 node app.js  # 256 colors
   FORCE_COLOR=3 node app.js  # TrueColor
   ```

**Solutions:**

1. Force TrueColor:
   ```bash
   COLORTERM=truecolor FORCE_COLOR=3 node app.js
   ```

2. Use specific terminal:
   ```bash
   TERM=xterm-256color node app.js
   ```

3. Check terminal settings:
   - Verify terminal supports TrueColor
   - Check terminal color scheme
   - Try different terminal emulator

### Issue: Background Colors Wrong

**Problem:**
Background colors don't render correctly.

**Solution:**

Use appropriate color combinations:
```typescript
import { white, bgRed, black, bgYellow } from '@visulima/colorize';

// Good contrast
console.log(white.bgRed('Error'));
console.log(black.bgYellow('Warning'));

// Poor contrast - avoid
console.log(yellow.bgYellow('Hard to read'));
```

### Issue: Gradient Not Working

**Problem:**
Gradient displays incorrectly or not at all.

**Solutions:**

1. Ensure TrueColor support:
   ```bash
   COLORTERM=truecolor node app.js
   ```

2. Check gradient syntax:
   ```typescript
   import { gradient } from '@visulima/colorize/gradient';

   // Correct
   console.log(gradient(['red', 'blue'])('Text'));
   
   // Note: Gradients need string long enough to show transition
   console.log(gradient(['red', 'blue'])('Very long text to show gradient'));
   ```

3. Note: Gradients not supported in browser version.

## Import Errors

### Issue: Cannot Find Module

**Problem:**
```
Error: Cannot find module '@visulima/colorize'
```

**Solutions:**

1. Verify installation:
   ```bash
   npm list @visulima/colorize
   ```

2. Reinstall package:
   ```bash
   npm install @visulima/colorize
   ```

3. Check import path:
   ```typescript
   // Correct
   import { red } from '@visulima/colorize';
   import template from '@visulima/colorize/template';
   import { gradient } from '@visulima/colorize/gradient';
   
   // Wrong
   import { red } from 'colorize';
   import { red } from '@visulima/colorize/colors';
   ```

### Issue: Named Import Error

**Problem:**
```
SyntaxError: Named export 'red' not found
```

**Solutions:**

1. Check import syntax:
   ```typescript
   // ESM
   import { red } from '@visulima/colorize';
   
   // CommonJS
   const { red } = require('@visulima/colorize');
   
   // Don't mix
   const red = require('@visulima/colorize').red; // Works but not ideal
   ```

2. Check file extension:
   ```json
   // package.json
   {
     "type": "module"  // For ESM
   }
   ```

### Issue: Browser Import Error

**Problem:**
```
Error: Module not found: Can't resolve '@visulima/colorize/browser'
```

**Solutions:**

1. Use correct import path:
   ```typescript
   // Correct
   import { red } from '@visulima/colorize/browser';
   
   // Wrong
   import { red } from '@visulima/colorize';
   ```

2. Check bundler configuration for proper module resolution.

## TypeScript Issues

### Issue: Type Errors

**Problem:**
```
TS2307: Cannot find module '@visulima/colorize' or its corresponding type declarations.
```

**Solutions:**

1. Ensure TypeScript version is 4.5+:
   ```bash
   npm install -D typescript@latest
   ```

2. Check tsconfig.json:
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "esModuleInterop": true,
       "skipLibCheck": false
     }
   }
   ```

3. Clear TypeScript cache:
   ```bash
   rm -rf node_modules/.cache
   ```

### Issue: Function Type Errors

**Problem:**
```typescript
const color = red;
color(123); // Error: Argument of type 'number' is not assignable to parameter of type 'string'
```

**Solution:**

Convert to string first:
```typescript
import { red } from '@visulima/colorize';

const value = 123;
console.log(red(String(value)));
console.log(red(`${value}`));
```

### Issue: Template Literal Type Error

**Problem:**
```typescript
red`Text ${number}`; // Type error
```

**Solution:**

Ensure template expressions are strings:
```typescript
import { red } from '@visulima/colorize';

const count = 42;
red`Count: ${String(count)}`; // Explicit conversion
red`Count: ${count}`; // Also works, auto-converted
```

## Browser Issues

### Issue: Array Output in Console

**Problem:**
```typescript
console.log(red('Text')); // Logs array instead of colored text
```

**Solution:**

Use spread operator in browser:
```typescript
import { red } from '@visulima/colorize/browser';

console.log(...red('Text')); // Correct
```

### Issue: Browser Colors Not Working

**Problem:**
Colors don't appear in browser console.

**Solutions:**

1. Check browser version:
   - Chrome 69+
   - Firefox 31+
   - Safari 6.1+

2. Check console settings:
   - Open DevTools
   - Check if console has color options enabled

3. Verify import path:
   ```typescript
   // Browser-specific import
   import { red } from '@visulima/colorize/browser';
   ```

### Issue: Nested Styles in Browser

**Problem:**
Nested styles don't render correctly in browser.

**Solution:**

Use simpler nesting:
```typescript
import { red, blue } from '@visulima/colorize/browser';

// May not work perfectly
console.log(...red`Error ${blue`detail`}`);

// Alternative - separate logs
console.log(...red('Error'), ...blue('detail'));
```

## Performance Issues

### Issue: Slow Rendering

**Problem:**
Colors cause noticeable slowdown.

**Solutions:**

1. Cache styled strings:
   ```typescript
   import { red, bold } from '@visulima/colorize';
   
   // Cache frequently used styles
   const ERROR = red.bold('[ERROR]');
   const SUCCESS = green.bold('[SUCCESS]');
   
   console.log(ERROR, 'Message 1');
   console.log(ERROR, 'Message 2');
   ```

2. Disable colors in production:
   ```bash
   NODE_ENV=production NO_COLOR=1 node app.js
   ```

3. Use named imports (better tree-shaking):
   ```typescript
   // Good
   import { red } from '@visulima/colorize';
   
   // Less optimal
   import colorize from '@visulima/colorize';
   ```

### Issue: Large Bundle Size

**Problem:**
Colorize increases bundle size significantly.

**Solutions:**

1. Use named imports:
   ```typescript
   // Tree-shakeable
   import { red, green } from '@visulima/colorize';
   ```

2. Check bundler configuration:
   ```javascript
   // webpack.config.js
   module.exports = {
     optimization: {
       usedExports: true,
     },
   };
   ```

3. Consider dynamic imports for CLI tools:
   ```typescript
   async function showError(message: string) {
     const { red } = await import('@visulima/colorize');
     console.error(red(message));
   }
   ```

## CI/CD Issues

### Issue: Colors Not Working in CI

**Problem:**
CI logs show ANSI codes or no colors.

**Solutions:**

1. Force colors in CI:
   ```yaml
   # GitHub Actions
   env:
     FORCE_COLOR: 3
   ```

2. Check CI environment detection:
   ```bash
   # Test locally with CI simulation
   CI=true FORCE_COLOR=3 node app.js
   ```

3. Verify CI supports colors:
   - GitHub Actions: Yes
   - GitLab CI: Yes
   - Travis CI: Yes
   - Jenkins: Depends on plugins

### Issue: Broken Output in CI

**Problem:**
ANSI codes break CI log parsing.

**Solution:**

Disable colors for CI if needed:
```yaml
# .github/workflows/test.yml
env:
  NO_COLOR: 1  # Only if CI doesn't support colors
```

### Issue: Docker Container Colors

**Problem:**
Colors don't work in Docker container.

**Solutions:**

1. Set environment in Dockerfile:
   ```dockerfile
   ENV FORCE_COLOR=3
   ENV TERM=xterm-256color
   ```

2. Pass environment when running:
   ```bash
   docker run -e FORCE_COLOR=3 myimage
   ```

3. Allocate TTY:
   ```bash
   docker run -it myimage
   ```

## Getting Help

If your issue isn't covered here:

1. Check the [FAQ](./faq.md)
2. Review the [API Reference](./api-reference.md)
3. Search [GitHub Issues](https://github.com/visulima/visulima/issues)
4. Create a new issue with:
   - Node.js version
   - Operating system
   - Terminal type
   - Minimal reproduction code
   - Error messages

## Debug Checklist

Use this checklist to diagnose issues:

```typescript
// Debug information
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('TTY:', process.stdout.isTTY);
console.log('TERM:', process.env.TERM);
console.log('COLORTERM:', process.env.COLORTERM);
console.log('NO_COLOR:', process.env.NO_COLOR);
console.log('FORCE_COLOR:', process.env.FORCE_COLOR);

// Test basic colors
import { red, green, blue } from '@visulima/colorize';
console.log('Test colors:', red('RED'), green('GREEN'), blue('BLUE'));
```

## Related Documentation

- [Installation](./installation.md) - Setup guide
- [Getting Started](./getting-started.md) - Basic usage
- [CLI & Environment](./cli-environment.md) - Configuration
- [FAQ](./faq.md) - Common questions
