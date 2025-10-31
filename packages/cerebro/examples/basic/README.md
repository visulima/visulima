# Basic Example

A simple example demonstrating basic Cerebro CLI usage.

## Run

### Using npm scripts:
```bash
pnpm start          # Show help
pnpm hello          # Run hello command
pnpm goodbye        # Say goodbye
```

### Using node directly:
```bash
# Show help
node cli.js help

# Run hello command with default name
node cli.js hello

# Run hello command with custom name
node cli.js hello Alice

# Run with custom greeting
node cli.js hello Bob --greeting "Hi"
node cli.js hello Bob -g "Hey"

# Run goodbye command
node cli.js goodbye
```

