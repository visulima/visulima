# Browser Usage

Complete guide to using `@visulima/colorize` in web browsers.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Browser API Differences](#browser-api-differences)
- [Console Styling](#console-styling)
- [Advanced Techniques](#advanced-techniques)
- [Limitations](#limitations)
- [Browser Compatibility](#browser-compatibility)

## Overview

Colorize provides full support for styling console output in web browsers. The browser version uses the `%c` syntax for Chrome and the CSS-based styling API for other browsers.

**Key Features:**
- Works in all modern browsers
- Same API as Node.js version
- Automatic browser detection
- Nested styles support
- Full color spectrum (TrueColor)

## Installation

Install Colorize as usual:

```bash
npm install @visulima/colorize
```

## Basic Usage

### Importing

Import from the browser-specific entry point:

```typescript
// ESM
import { red, green, blue, bold } from '@visulima/colorize/browser';

// Or default import
import colorize from '@visulima/colorize/browser';
```

### Important: Spread Operator

The browser version returns arrays that must be spread into `console.log`:

```typescript
import { red, green, blue } from '@visulima/colorize/browser';

// Correct - use spread operator
console.log(...red('Error message'));
console.log(...green('Success'));

// Incorrect - will log an array
console.log(red('Error message')); // Wrong!
```

### Why Arrays?

Browser consoles use the `%c` syntax for styling:

```typescript
// What Colorize generates internally:
console.log('%cError message', 'color: red');

// Returns as:
['%cError message', 'color: red']
```

## Browser API Differences

The browser version has the same API as Node.js, with one key difference:

**Node.js:**
```typescript
import { red } from '@visulima/colorize';
console.log(red('Text')); // Returns: string
```

**Browser:**
```typescript
import { red } from '@visulima/colorize/browser';
console.log(...red('Text')); // Returns: array, must spread
```

All functions, colors, and features work the same way:
- Colors (red, green, blue, etc.)
- Styles (bold, italic, underline)
- TrueColor (hex, rgb)
- Chaining
- Nesting
- Templates

## Console Styling

### Basic Colors

```typescript
import { red, green, blue, yellow } from '@visulima/colorize/browser';

console.log(...red('Red text'));
console.log(...green('Green text'));
console.log(...blue('Blue text'));
console.log(...yellow('Yellow text'));
```

### Text Styles

```typescript
import { bold, italic, underline } from '@visulima/colorize/browser';

console.log(...bold('Bold text'));
console.log(...italic('Italic text'));
console.log(...underline('Underlined text'));
```

### Chained Styles

```typescript
import { red, bold, underline } from '@visulima/colorize/browser';

console.log(...red.bold('Bold red text'));
console.log(...red.bold.underline('Bold, underlined red text'));
```

### Background Colors

```typescript
import { white, bgRed, bgGreen, bgBlue } from '@visulima/colorize/browser';

console.log(...white.bgRed('White on red'));
console.log(...white.bgGreen('White on green'));
console.log(...white.bgBlue('White on blue'));
```

### TrueColor

```typescript
import { hex, rgb, bgHex } from '@visulima/colorize/browser';

// Hex colors
console.log(...hex('#FF69B4')('Hot pink'));
console.log(...hex('#00CED1')('Dark turquoise'));

// RGB colors
console.log(...rgb(255, 99, 71)('Tomato'));
console.log(...rgb(32, 178, 170)('Light sea green'));

// Background hex
console.log(...bgHex('#FF69B4')('Hot pink background'));
```

### Nested Styles

```typescript
import { red, blue, green, bold } from '@visulima/colorize/browser';

console.log(...red`Error: ${blue.bold`file.js`} not found`);
console.log(...green`Status: ${bold`OK`} - All tests passed`);
```

## Advanced Techniques

### Logging Helper

Create a wrapper to avoid spreading:

```typescript
import { red, green, yellow, blue } from '@visulima/colorize/browser';

const log = {
  error: (...args: any[]) => console.error(...red(args.join(' '))),
  warn: (...args: any[]) => console.warn(...yellow(args.join(' '))),
  info: (...args: any[]) => console.info(...blue(args.join(' '))),
  success: (...args: any[]) => console.log(...green(args.join(' '))),
};

log.error('Connection failed');
log.success('Data loaded');
log.info('Processing request');
log.warn('Deprecated API');
```

### Console Override

Override console methods to handle arrays automatically:

```typescript
import { red, green, yellow } from '@visulima/colorize/browser';

// Save original methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Override with array handling
console.log = (...args: any[]) => {
  const processed = args.map(arg => 
    Array.isArray(arg) && arg.length >= 2 && arg[0].includes('%c') 
      ? arg 
      : [arg]
  ).flat();
  originalLog(...processed);
};

console.error = (...args: any[]) => {
  const processed = args.map(arg => 
    Array.isArray(arg) && arg.length >= 2 && arg[0].includes('%c') 
      ? arg 
      : [arg]
  ).flat();
  originalError(...processed);
};

console.warn = (...args: any[]) => {
  const processed = args.map(arg => 
    Array.isArray(arg) && arg.length >= 2 && arg[0].includes('%c') 
      ? arg 
      : [arg]
  ).flat();
  originalWarn(...processed);
};

// Now you can use without spreading
console.log(red('Error')); // Works!
console.log(green('Success')); // Works!
```

Note: This approach loses accurate file/line information in the console.

### Conditional Logging

Show colors only in development:

```typescript
import { red, green } from '@visulima/colorize/browser';

const isDevelopment = process.env.NODE_ENV === 'development';

function log(message: string, color: (text: string) => any[]) {
  if (isDevelopment) {
    console.log(...color(message));
  } else {
    console.log(message);
  }
}

log('Debug message', red);
log('Status update', green);
```

### Logger Class

Implement a comprehensive logging system:

```typescript
import { red, yellow, blue, green, gray, bold } from '@visulima/colorize/browser';

class BrowserLogger {
  private timestamp(): string {
    return new Date().toISOString();
  }

  error(message: string, ...args: any[]) {
    console.error(
      ...gray(`[${this.timestamp()}]`),
      ...red(bold('[ERROR]')),
      message,
      ...args
    );
  }

  warn(message: string, ...args: any[]) {
    console.warn(
      ...gray(`[${this.timestamp()}]`),
      ...yellow(bold('[WARN]')),
      message,
      ...args
    );
  }

  info(message: string, ...args: any[]) {
    console.info(
      ...gray(`[${this.timestamp()}]`),
      ...blue(bold('[INFO]')),
      message,
      ...args
    );
  }

  success(message: string, ...args: any[]) {
    console.log(
      ...gray(`[${this.timestamp()}]`),
      ...green(bold('[SUCCESS]')),
      message,
      ...args
    );
  }

  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        ...gray(`[${this.timestamp()}]`),
        ...gray('[DEBUG]'),
        ...gray(message),
        ...args
      );
    }
  }
}

const logger = new BrowserLogger();

logger.info('Application started');
logger.success('User logged in');
logger.warn('Session expiring soon');
logger.error('Failed to fetch data');
logger.debug('State:', { user: 'john', id: 123 });
```

### Grouped Logs

Use console groups with colors:

```typescript
import { cyan, green, red, bold } from '@visulima/colorize/browser';

function logApiRequest(method: string, url: string, status: number, data: any) {
  console.group(...cyan(bold(`${method} ${url}`)));
  
  const statusColor = status < 400 ? green : red;
  console.log(...statusColor(`Status: ${status}`));
  console.log('Response:', data);
  
  console.groupEnd();
}

logApiRequest('GET', '/api/users', 200, { users: [] });
logApiRequest('POST', '/api/login', 401, { error: 'Unauthorized' });
```

### Table Styling

Style console tables:

```typescript
import { bold, cyan, green, red } from '@visulima/colorize/browser';

interface User {
  id: number;
  name: string;
  status: 'active' | 'inactive';
}

function displayUsers(users: User[]) {
  console.log(...bold(cyan('User List')));
  console.table(users);
}

displayUsers([
  { id: 1, name: 'Alice', status: 'active' },
  { id: 2, name: 'Bob', status: 'inactive' },
  { id: 3, name: 'Charlie', status: 'active' },
]);
```

## Limitations

### Current Limitations

1. **Spread Operator Required**: Must use spread operator with console methods
2. **No Gradient Support**: Gradient functions are not available in browser version
3. **Limited Template Support**: Tagged templates work differently
4. **Style Mixing**: Some style combinations may not render in all browsers

### Workarounds

#### Spread Operator

Use the console override technique shown above, or create helper functions.

#### Multiple Styled Segments

```typescript
import { red, blue, green } from '@visulima/colorize/browser';

// Each segment needs spreading
console.log(
  ...red('Error:'),
  ' ',
  ...blue('file.js'),
  ' ',
  ...green('line 42')
);

// Or combine into one
console.log(...red`Error: ${blue('file.js')} line ${green('42')}`);
```

## Browser Compatibility

### Supported Browsers

**Full Support (Native ANSI):**
- Chrome 69+
- Edge 79+
- Opera 56+
- All Chromium-based browsers

**CSS Support (%c syntax):**
- Firefox 31+
- Safari 6.1+

### Feature Detection

Check if styling is supported:

```typescript
function supportsConsoleStyling(): boolean {
  return typeof window !== 'undefined' && 
         typeof console !== 'undefined' &&
         typeof console.log === 'function';
}

if (supportsConsoleStyling()) {
  // Use colored output
} else {
  // Fall back to plain text
}
```

### Browser-Specific Behavior

Different browsers may render styles slightly differently:

**Chrome/Chromium:**
- Full color support
- Best styling capabilities
- Supports all text decorations

**Firefox:**
- Good color support
- Some style limitations
- May not support all combinations

**Safari:**
- Basic color support
- Limited style support
- Some decorations may not work

## React Integration

### Development Tools

Use Colorize in React DevTools:

```typescript
import { useEffect } from 'react';
import { blue, green, yellow, bold } from '@visulima/colorize/browser';

function MyComponent() {
  useEffect(() => {
    console.log(...blue(bold('Component mounted')));
    
    return () => {
      console.log(...yellow(bold('Component unmounting')));
    };
  }, []);

  return <div>My Component</div>;
}
```

### Redux Logger

Enhance Redux logs:

```typescript
import { createStore, applyMiddleware } from 'redux';
import { cyan, green, yellow, bold } from '@visulima/colorize/browser';

const loggerMiddleware = (store) => (next) => (action) => {
  console.group(...cyan(bold(`Action: ${action.type}`)));
  console.log(...yellow('Previous state:'), store.getState());
  console.log(...green('Action:'), action);
  
  const result = next(action);
  
  console.log(...yellow('Next state:'), store.getState());
  console.groupEnd();
  
  return result;
};
```

## Vue Integration

### Vue DevTools

```typescript
import { createApp } from 'vue';
import { green, red, yellow } from '@visulima/colorize/browser';

const app = createApp({
  mounted() {
    console.log(...green('Vue app mounted'));
  },
  errorCaptured(err) {
    console.error(...red('Error captured:'), err);
    return false;
  }
});
```

## Best Practices

### Performance

Minimize styling in production:

```typescript
const isProd = process.env.NODE_ENV === 'production';

const log = isProd 
  ? console.log.bind(console)
  : (...args: any[]) => console.log(...args);

// Use log() instead of console.log()
```

### Consistency

Create a style guide:

```typescript
import { red, yellow, blue, green, bold } from '@visulima/colorize/browser';

export const CONSOLE_STYLES = {
  error: red.bold,
  warn: yellow.bold,
  info: blue,
  success: green.bold,
  debug: gray,
} as const;
```

### Debugging

Use colors to differentiate log sources:

```typescript
import { cyan, magenta, yellow } from '@visulima/colorize/browser';

const createLogger = (prefix: string, color: any) => ({
  log: (...args: any[]) => console.log(...color(`[${prefix}]`), ...args)
});

const apiLogger = createLogger('API', cyan);
const storeLogger = createLogger('Store', magenta);
const routerLogger = createLogger('Router', yellow);

apiLogger.log('Request sent');
storeLogger.log('State updated');
routerLogger.log('Navigation triggered');
```

## Related

- [Getting Started](./getting-started.md) - Basic usage
- [API Reference](./api-reference.md) - Complete API
- [Examples](./examples.md) - More examples
