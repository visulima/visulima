# Pail Bun Example

This example demonstrates how to use Pail logging library in Bun.

## Requirements

- Bun 1.0+

## Running the Example

```bash
# Install dependencies
bun install

# Run the example
bun run start

# Or run directly
bun example.ts

# Run with hot reloading
bun run dev
```

## Features Demonstrated

- Basic logging methods (info, success, debug, warning, error)
- Scoped loggers
- Custom logger types
- Timer functionality
- Interactive logging (when running in terminal)
- Error handling with pail.fatal()
- Custom completion messages
- Bun-specific runtime information

## Notes

- Pail works seamlessly in Bun thanks to its Node.js compatibility
- All pail features are supported in Bun runtime
- The interactive logging features work when running in a TTY environment
- Bun provides Web APIs and Node.js APIs out of the box
- Hot reloading is supported with `bun --hot`
