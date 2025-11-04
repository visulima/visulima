# Logging Examples

Demonstrates different logger configurations in Cerebro CLI.

## Features

- **Console Logger**: Default lightweight logger (fast initialization)
- **Pail Logger**: Feature-rich logger with colors and structured output (lazy-loaded)
- **Custom Logger**: Your own logger implementation

## Run

### Using npm scripts:

```bash
pnpm start      # Console logger (default)
pnpm console    # Console logger (explicit)
pnpm pail       # Pail logger (pretty output)
pnpm custom     # Custom logger
```

### Using node directly:

```bash
# Console logger (default)
node cli.js test
# or
LOGGER=console node cli.js test

# Pail logger (pretty output)
LOGGER=pail node cli.js test

# Custom logger
LOGGER=custom node cli.js test
```

## Logger Comparison

### Console Logger

- ✅ Fast initialization
- ✅ Lightweight
- ✅ Perfect for most CLIs
- ✅ No external dependencies

### Pail Logger

- ✅ Pretty output with colors
- ✅ Structured logging
- ✅ Lazy-loaded (no overhead until first log)
- ⚠️ Requires `@visulima/pail` peer dependency

### Custom Logger

- ✅ Full control over logging behavior
- ✅ Can integrate with any logging library
- ✅ Implement only the methods you need
