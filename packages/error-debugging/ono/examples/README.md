# Ono Examples

This directory contains examples demonstrating how to use Ono with different JavaScript runtimes and frameworks.

## Available Examples

### 🚀 Runtime Examples

| Runtime     | Directory          | Features                       | Port |
| ----------- | ------------------ | ------------------------------ | ---- |
| **Node.js** | [`node/`](./node/) | HTTP server, deep stack traces | 3000 |
| **Bun**     | [`bun/`](./bun/)   | Hot reload, SQLite, performance | 3001 |

### 🛠️ Framework Examples

| Framework | Directory          | Features                         |
| --------- | ------------------ | -------------------------------- | --- |
| **Hono**  | [`hono/`](./hono/) | Modern web framework integration | -   |
| **CLI**   | [`cli/`](./cli/)   | Command-line error handling      | -   |

## Quick Start

### Node.js Example

```bash
cd node
npm install
npm run dev
# Visit http://localhost:3000
```

### Bun Example

```bash
cd bun
bun run serve
# Visit http://localhost:3001
```

### Hono Example

```bash
cd hono
npm install
npm run dev
```

### CLI Example

```bash
cd cli
npm install
npm run dev
```

## Runtime Comparison

| Feature             | Node.js               | Bun           |
| ------------------- | --------------------- | ------------- |
| **Package Manager** | npm/yarn/pnpm         | Built-in      |
| **HTTP Server**     | `http.createServer()` | `Bun.serve()` |
| **Permissions**     | ❌                    | ⚠️ Limited    |
| **Startup Time**    | Slow                  | ⚡ Ultra-fast |
| **Hot Reload**      | ❌ (3rd party)        | ✅            |
| **SQLite**          | ❌ (3rd party)        | ✅ Built-in   |
| **TypeScript**      | ❌ (tsc)              | ✅ Built-in   |
| **Web APIs**        | ❌ (polyfills)        | ✅            |

## Example Features

### Common Features

- ✅ Error rendering with Ono
- ✅ Custom solution finders
- ✅ Request context pages
- ✅ ANSI and HTML output
- ✅ CSP nonce support
- ✅ Theme support

### Runtime-Specific Features

#### Node.js

- Deep stack trace examples
- Process environment variables
- Memory usage tracking
- File system operations

#### Bun

- Hot reload demonstration
- Built-in SQLite integration
- Performance metrics
- Ultra-fast startup times

## Development

Each example is self-contained and can be run independently:

```bash
# Run all examples simultaneously (requires tmux/screen)
# Terminal 1
cd node && npm run dev

# Terminal 2
cd bun && bun run serve

# Terminal 3
cd hono && npm run dev

# Terminal 4
cd cli && npm run dev
```

## Contributing

To add a new example:

1. Create a new directory under `examples/`
2. Add a `README.md` with setup instructions
3. Add appropriate configuration files (`package.json`, etc.)
4. Update this main `README.md`
5. Test the example works correctly

## Support

If you encounter issues with any example:

1. Check the runtime-specific documentation
2. Ensure all dependencies are installed
3. Verify the correct ports are available
4. Check for runtime-specific permission requirements

For Bun examples, ensure you have the latest version:

```bash
bun upgrade
```
