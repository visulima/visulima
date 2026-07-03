# Deno + Ono Example

This example demonstrates how to use Ono with Deno, showcasing Deno-specific features and error handling.

## Features Demonstrated

- **Deno HTTP Server**: Using `Deno.serve()` for modern HTTP handling
- **Deno Permissions**: Checking runtime permissions
- **Deno Environment**: Accessing Deno-specific environment variables
- **Deno Deploy**: Configuration for Deno Deploy platform
- **TypeScript**: Full TypeScript support with Deno
- **Import Maps**: Clean module resolution with import maps

## Running the Example

### Prerequisites

Make sure you have Deno installed:

```bash
# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Or using package managers
# macOS
brew install deno

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# Linux
curl -fsSL https://deno.land/install.sh | sh
```

### Start the Server

```bash
# Using Deno task (recommended)
deno task dev

# Or directly
deno run --allow-net --allow-read --allow-env index.ts

# With hot reload
deno task serve
```

The server will start at `http://localhost:8000`.

## Available Routes

- **`/`** - Home page with route overview
- **`/error`** - Basic error with Deno context information
- **`/deno-specific`** - Deno-specific error with custom solution finder
- **`/error-json`** - JSON API error response

## Deno-Specific Features

### Runtime Information

The example captures Deno-specific runtime information:

- Deno version, V8 version, TypeScript version
- Runtime permissions (read, write, net, env, run)
- Environment variables (DENO_DEPLOYMENT_ID, DENO_REGION, etc.)

### Permission System

Deno has a unique permission system. The example demonstrates:

```typescript
const permissions = {
    read: await Deno.permissions.query({ name: "read" }),
    write: await Deno.permissions.query({ name: "write" }),
    net: await Deno.permissions.query({ name: "net" }),
    env: await Deno.permissions.query({ name: "env" }),
    run: await Deno.permissions.query({ name: "run" }),
};
```

### Custom Solution Finders

Deno-specific solution finders help with common Deno issues:

- Missing `DENO_DEPLOYMENT_ID` environment variable
- `deno.json` configuration issues
- Import map problems

## Configuration Files

### `deno.json`

```json
{
    "compilerOptions": {
        "allowJs": true,
        "lib": ["deno.window"],
        "strict": true
    },
    "importMap": "import_map.json",
    "tasks": {
        "dev": "deno run --allow-net --allow-read --allow-env index.ts",
        "serve": "deno run --allow-net --allow-read --allow-env --watch index.ts"
    }
}
```

### `import_map.json`

```json
{
    "imports": {
        "@visulima/ono": "../../src/index.ts",
        "@visulima/ono/": "../../src/"
    }
}
```

## Deploying to Deno Deploy

1. Push your code to GitHub
2. Connect to [Deno Deploy](https://deno.com/deploy)
3. Set environment variables:
    - `DENO_DEPLOYMENT_ID` - Your deployment ID
    - `DENO_REGION` - Deployment region
    - `DENO_ENV` - Environment (production, staging, etc.)

## Key Differences from Node.js

- **No `package.json`**: Deno uses URL imports and doesn't need `node_modules`
- **Built-in TypeScript**: No separate compilation step needed
- **Secure by default**: Explicit permissions required for file, network, and environment access
- **Modern APIs**: Uses `Deno.serve()` instead of Node's HTTP server
- **Standard library**: Rich standard library for common tasks

## Error Context

The example demonstrates how Ono captures Deno-specific context:

```typescript
const denoContext = {
    runtime: {
        name: "Deno",
        version: Deno.version.deno,
        v8: Deno.version.v8,
        typescript: Deno.version.typescript,
    },
    permissions: {
        /* ... */
    },
    environment: {
        /* ... */
    },
};
```

This provides comprehensive debugging information specific to Deno applications.
