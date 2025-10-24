# Error Handler Plugin Examples

This directory contains examples demonstrating the `errorHandlerPlugin` functionality in Cerebro.

## Quick Start

Build the cerebro package first:
```bash
cd packages/cerebro
pnpm run build
```

## Running Examples

### Method 1: Main CLI with Error Commands

The main CLI includes error handler plugin with detailed logging enabled:

```bash
cd examples
node cli.js error-simple
node cli.js error-detailed
node cli.js error-critical
node cli.js error-custom-formatter
```

### Method 2: Dedicated Error Handler CLI

For focused error handling demonstrations:

```bash
cd examples
node error-handler-cli.js error-simple
node error-handler-cli.js error-detailed
node error-handler-cli.js error-critical
node error-handler-cli.js error-custom-formatter
```

## Examples Explained

### 1. Simple Error (error-simple)
Default error handling without plugin configuration.
- **Command**: `node cli.js error-simple`
- **Demonstrates**: Basic error logging

### 2. Detailed Error (error-detailed)
Enhanced error logging with stack traces and additional properties.
- **Command**: `node cli.js error-detailed`
- **Plugin Config**:
  ```js
  errorHandlerPlugin({ detailed: true })
  ```
- **Demonstrates**: 
  - Full error details (name, message, code)
  - Stack trace with proper formatting
  - Additional custom error properties

### 3. Critical Error (error-critical)
Severe errors logged at critical level.
- **Command**: `node cli.js error-critical`
- **Plugin Config**:
  ```js
  errorHandlerPlugin({ 
      detailed: true,
      useCriticalLevel: true 
  })
  ```
- **Demonstrates**:
  - Using `critical` log level for severe errors
  - Detailed error information with higher priority

### 4. Custom Formatter (error-custom-formatter)
Custom error formatting for branded error messages.
- **Command**: `node cli.js error-custom-formatter`
- **Plugin Config**:
  ```js
  errorHandlerPlugin({
      formatter: (error) => {
          return `🚨 ${error.errorId}: ${error.message}`;
      }
  })
  ```
- **Demonstrates**:
  - Custom error formatting
  - Branded error reports
  - Extracting custom error properties

## Plugin Configuration Options

```typescript
errorHandlerPlugin({
    // Show detailed error info (default: false)
    detailed?: boolean;
    
    // Exit process after error (default: true)
    exitOnError?: boolean;
    
    // Custom error formatter
    formatter?: (error: Error) => string;
    
    // Whether to log errors (default: true)
    logErrors?: boolean;
    
    // Use critical log level (default: false)
    useCriticalLevel?: boolean;
})
```

## Adding Custom Error Properties

You can add custom properties to errors for better debugging:

```javascript
const error = new Error("Something went wrong");
error.code = "ERR_DEMO";
error.statusCode = 500;
error.userId = 123;
error.context = { action: "test", timestamp: Date.now() };

throw error;
```

The `detailed` mode will automatically display these additional properties.

## Integration Example

```javascript
import { Cerebro, errorHandlerPlugin } from "@visulima/cerebro";

const cli = new Cerebro("my-cli");

// Add error handler with detailed logging
cli.addPlugin(errorHandlerPlugin({
    detailed: true,
    useCriticalLevel: false,
    exitOnError: true
}));

// Your commands...
cli.addCommand({
    name: "risky-operation",
    execute: () => {
        throw new Error("Operation failed");
    }
});

await cli.run();
```

