# Error Handling Examples

Demonstrates different error handling strategies with the error handler plugin.

## Features

- **Simple Errors**: Default error handling
- **Detailed Errors**: Stack traces and additional error properties
- **Critical Errors**: Critical level logging for severe errors
- **Custom Formatting**: Custom error message formatting

## Run

### Using npm scripts:
```bash
pnpm start              # Show available examples
pnpm simple             # Simple error handling
pnpm detailed           # Detailed error logging
pnpm critical           # Critical level error logging
pnpm custom-formatter   # Custom error formatting
```

### Using node directly:
```bash
# Show available examples
node cli.js

# Simple error handling (default)
node cli.js error-simple

# Detailed error logging with stack traces
node cli.js error-detailed

# Critical level error logging
node cli.js error-critical

# Custom error formatting
node cli.js error-custom-formatter
```

## Error Handling Configuration

Each example demonstrates different `errorHandlerPlugin` configurations:

- **Default**: Basic error messages
- **Detailed**: Includes stack traces and error properties
- **Critical Level**: Uses critical log level for severe errors
- **Custom Formatter**: Custom error message templates

