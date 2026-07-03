# Bun + Ono Example

This example demonstrates how to use Ono with Bun, showcasing Bun's performance benefits, hot reload, and native SQLite integration.

## Features Demonstrated

- **Bun HTTP Server**: Using `Bun.serve()` for ultra-fast HTTP handling
- **Hot Reload**: Live code reloading during development
- **Performance Metrics**: High-precision timing with `performance.now()`
- **SQLite Integration**: Bun's built-in SQLite support
- **Fast Startup**: Experience Bun's lightning-fast startup times
- **TypeScript**: Full TypeScript support with Bun

## Running the Example

### Prerequisites

Make sure you have Bun installed:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Or using package managers
# macOS
brew install oven-sh/bun/bun

# Linux/Windows
curl -fsSL https://bun.sh/install | bash
```

### Start the Server

```bash
# Development mode (with hot reload)
bun run serve

# Or regular development mode
bun run dev

# Production build
bun run build
bun run start
```

The server will start at `http://localhost:3001`.

## Available Routes

- **`/`** - Home page with Bun runtime information
- **`/error`** - Basic error with Bun context
- **`/bun-specific`** - Bun-specific error with custom solution finder
- **`/performance`** - Performance metrics demonstration
- **`/sqlite`** - SQLite integration example

## Bun-Specific Features

### Hot Reload

Bun supports hot reloading out of the box:

```bash
bun --hot run index.ts
```

Edit the file and see changes instantly without restarting the server!

### Performance Monitoring

The example demonstrates Bun's high-precision performance APIs:

```typescript
const startTime = performance.now();
// ... do work ...
const endTime = performance.now();
const duration = endTime - startTime; // Microsecond precision
```

### SQLite Integration

Bun has built-in SQLite support:

```typescript
const db = new Bun.sqlite(":memory:");
db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
const insert = db.prepare("INSERT INTO test VALUES (?, ?)");
insert.run(1, "Bun");
const results = db.query("SELECT * FROM test").all();
```

### Fast Startup Times

Bun is significantly faster than Node.js:

- **Startup time**: ~10-100x faster than Node.js
- **Memory usage**: Lower memory footprint
- **Package resolution**: Instant dependency resolution

## Configuration

### `package.json`

```json
{
    "name": "bun_example_ono",
    "scripts": {
        "dev": "bun run index.ts",
        "serve": "bun --hot run index.ts",
        "build": "bun build index.ts --outdir dist",
        "start": "bun run dist/index.js"
    },
    "dependencies": {
        "@visulima/ono": "workspace:*"
    }
}
```

## Runtime Information

The example captures Bun-specific context:

```typescript
const bunContext = {
    runtime: {
        name: "Bun",
        version: Bun.version,
        platform: process.platform,
        arch: process.arch,
    },
    performance: {
        startupTime: performance.now(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
    },
    bunFeatures: {
        hotReload: true,
        fastStartup: true,
        nativeSQLite: true,
        webAPIs: true,
    },
};
```

## Key Differences from Node.js

### Performance

- **Startup**: ~10-100x faster than Node.js
- **Hot Reload**: Instant file watching and reloading
- **Memory**: Lower memory usage
- **Resolution**: Faster dependency resolution

### APIs

- **Server**: `Bun.serve()` instead of `http.createServer()`
- **SQLite**: Built-in `new Bun.sqlite()` instead of external packages
- **Sleep**: `Bun.sleep()` for high-precision timing
- **Web APIs**: Full Web API compatibility

### Development Experience

- **TypeScript**: Built-in TypeScript support without configuration
- **Hot Reload**: `--hot` flag for instant reloading
- **Package Manager**: `bun install` is significantly faster
- **Runner**: `bun run` can run TypeScript, JSX, and more directly

## Custom Solution Finders

Bun-specific solution finders help with common Bun issues:

- Missing `BUN_ENV` environment variable
- `bunfig.toml` configuration issues
- SQLite database problems

## Deployment

Bun applications can be deployed to:

- **Railway**: Native Bun support
- **Fly.io**: Container deployment
- **Vercel**: Edge runtime deployment
- **Self-hosted**: Direct Bun deployment

## Error Context

The example demonstrates how Ono captures Bun-specific context including:

- Bun version and runtime information
- Performance metrics with microsecond precision
- Hot reload status
- SQLite integration status
- Environment configuration

This provides comprehensive debugging information specific to Bun applications.
