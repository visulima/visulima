# Error Handling Examples

Demonstrates different error handling strategies with the error handler plugin using `@visulima/error` for beautiful error formatting.

## Features

- **Simple Errors**: Default error handling
- **Detailed Errors**: Beautiful code frames, stack traces, and error properties using `@visulima/error`
- **Custom Formatting**: Custom error message formatting
- **Render Options**: Customizable `renderError` options for fine-grained control

## Run

### Using npm scripts:

```bash
pnpm start              # Show available examples
pnpm simple             # Simple error handling
pnpm detailed           # Detailed error logging with code frames
pnpm custom-formatter   # Custom error formatting
pnpm render-options      # Custom renderError options
```

### Using node directly:

```bash
# Show available examples
node cli.js

# Simple error handling (default)
node cli-simple.js

# Detailed error logging with code frames and stack traces
node cli-detailed.js

# Custom error formatting
node cli-custom-formatter.js

# Custom renderError options
node cli-render-options.js
```

## Error Handling Configuration

Each example demonstrates different `errorHandlerPlugin` configurations:

- **Default**: Basic error messages
- **Detailed**: Beautiful code frames, stack traces, and error properties using `@visulima/error`'s `renderError`
- **Custom Formatter**: Custom error message templates
- **Render Options**: Fine-grained control over error rendering (lines above/below, frame limits, etc.)

## Using @visulima/error

The detailed error handler uses `@visulima/error`'s `renderError` function which provides:

- **Code Frames**: Highlighted code snippets showing where errors occurred
- **Stack Traces**: Parsed and formatted stack traces with file paths and line numbers
- **Error Hints**: Helpful hints (when using `VisulimaError`)
- **Beautiful Formatting**: Colorized and formatted error output

### Example with VisulimaError

```javascript
import { VisulimaError } from "@visulima/error";

const error = new VisulimaError({
    name: "MyError",
    message: "Something went wrong",
    hint: "Try checking your configuration file",
    location: {
        file: "./config.js",
        line: 10,
        column: 5,
    },
});

throw error;
```
