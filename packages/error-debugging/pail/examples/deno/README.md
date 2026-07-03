# Pail Deno Example

This example demonstrates how to use Pail logging library in Deno.

## Requirements

- Deno 1.40+ (for Node.js compatibility)

## Running the Example

```bash
# Run the example
deno run --allow-all example.ts

# Or run with explicit permissions
deno run --allow-read --allow-write --allow-net example.ts
```

## Features Demonstrated

- Basic logging methods (info, success, debug, warning, error)
- Scoped loggers
- Custom logger types
- Timer functionality
- Interactive logging (when running in terminal)
- Error handling with pail.fatal()
- Custom completion messages

## Notes

- Pail works seamlessly in Deno thanks to its Node.js compatibility layer
- All pail features are supported in Deno runtime
- The interactive logging features work when running in a TTY environment
