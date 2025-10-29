# Cerebro Examples

This directory contains organized examples demonstrating various features of the Cerebro CLI framework.

## 📁 Structure

```
examples/
├── basic/              # Simple CLI basics
├── options/            # Option handling features
├── error-handling/     # Error handling strategies
├── logging/            # Logger configurations
└── completion/         # Shell autocompletion
```

## 🚀 Quick Start

Each example directory contains:
- A `cli.js` file - The working CLI application
- A `README.md` - Detailed usage instructions

## 📚 Examples Overview

### [Basic](./basic/)
Learn the fundamentals of building a CLI with Cerebro:
- Creating commands
- Using arguments
- Adding options
- Basic command execution

**Run:** `cd basic && node cli.js help`

### [Options](./options/)
Explore advanced option handling:
- Default values and aliases
- Negatable options (`--no-` prefix)
- Conflicting options
- Implied options
- Required options
- Boolean or value options

**Run:** `cd options && node cli.js help`

### [Error Handling](./error-handling/)
Different error handling strategies:
- Simple error messages
- Detailed stack traces
- Critical level logging
- Custom error formatting

**Run:** `cd error-handling && node cli.js`

### [Logging](./logging/)
Logger configuration options:
- Console logger (default, lightweight)
- Pail logger (pretty output, feature-rich)
- Custom logger implementation

**Run:** `cd logging && node cli.js test`

### [Completion](./completion/)
Shell autocompletion integration:
- Automatic command discovery
- Option autocompletion
- Multi-shell support (bash, zsh, fish, powershell)

**Prerequisites:** `pnpm add @bomb.sh/tab`

**Run:** `cd completion && node cli.js completion --shell=zsh`

## 🛠️ Development

All examples use the local `@visulima/cerebro` package via workspace protocol.

```bash
# Install dependencies (from repo root)
pnpm install

# Build the cerebro package
cd packages/cerebro && pnpm run build

# Run any example
cd examples/basic && node cli.js help
```

## 📖 Documentation

For full documentation, visit the [main README](../README.md) or the [Visulima documentation](https://visulima.com/packages/cerebro).

