# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/cerebro` package.

## Version 2.0.0 (Upcoming)

### Breaking Changes Summary

- **Minimum Node.js version**: 20.19+ required
- **Module format**: ESM-only (CommonJS removed)
- **Import structure**: Granular plugin and command exports
- **Error handling**: Enhanced error types and validation

### CommonJS (CJS) Export Removed

The CommonJS (CJS) export has been removed in favor of ECMAScript Modules (ESM) only. For CJS compatibility in Node.js 20.19+, use dynamic imports.

#### Before (v1.x)

```javascript
// This no longer works
const { Cerebro, createCerebro } = require("@visulima/cerebro");
```

#### After (v2.x) - Node.js 20.19+

```javascript
// Use dynamic import for ESM modules from CJS
const { Cerebro, createCerebro } = await import("@visulima/cerebro");
```

#### Alternative: Convert to ESM

For better compatibility and performance, convert your project to use ESM:

```json
// package.json
{
    "name": "your-project",
    "version": "1.0.0",
    "type": "module"
}
```

```typescript
// Your files can now use ESM imports
import { createCerebro } from "@visulima/cerebro";

const cli = createCerebro("my-app", {
    packageName: "my-app",
    packageVersion: "1.0.0",
});

cli.addCommand({
    execute: ({ logger }) => {
        logger.info("Hello ESM world!");
    },
    name: "hello",
});

await cli.run();
```

### Granular Plugin and Command Exports

Plugins and commands are now exported from specific paths for better tree-shaking and smaller bundle sizes.

#### Old Export Structure

```javascript
// This may work but is not recommended
import { errorHandlerPlugin } from "@visulima/cerebro";
```

#### New Granular Export Structure

```javascript
// Import plugins from specific paths
import { completionCommand } from "@visulima/cerebro/command/completion";
// Import commands from specific paths
import { helpCommand } from "@visulima/cerebro/command/help";
import { versionCommand } from "@visulima/cerebro/command/version";
// Import logger utilities
import { createPailLogger } from "@visulima/cerebro/logger/pail";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
import { runtimeVersionCheckPlugin } from "@visulima/cerebro/plugins/runtime-version-check";
import { updateNotifierPlugin } from "@visulima/cerebro/plugins/update-notifier";
```

#### Benefits

- **Smaller bundle sizes**: Only import what you need
- **Better tree-shaking**: Unused code is excluded from bundles
- **Clearer dependencies**: Explicit imports make dependencies obvious
- **Improved performance**: Reduced bundle size and faster loading

### Nested Command Support

Cerebro now supports nested commands (subcommands) using the `commandPath` property. This allows you to create hierarchical command structures like `cli deploy staging` or `cli db migrate up`.

#### Defining Nested Commands

Create nested commands by specifying a `commandPath` array in your command definition:

```typescript
// Parent command path: ["deploy"]
cli.addCommand({
    name: "staging",
    commandPath: ["deploy"],
    description: "Deploy to staging environment",
    execute: ({ logger }) => {
        logger.info("Deploying to staging...");
    },
});

cli.addCommand({
    name: "production",
    commandPath: ["deploy"],
    description: "Deploy to production environment",
    execute: ({ logger }) => {
        logger.info("Deploying to production...");
    },
});
```

Usage:

```bash
cli deploy staging
cli deploy production
```

#### Multi-Level Nested Commands

You can nest commands multiple levels deep:

```typescript
cli.addCommand({
    name: "up",
    commandPath: ["db", "migrate"],
    description: "Run database migrations",
    execute: ({ logger }) => {
        logger.info("Running migrations...");
    },
});

cli.addCommand({
    name: "down",
    commandPath: ["db", "migrate"],
    description: "Rollback database migrations",
    execute: ({ logger }) => {
        logger.info("Rolling back migrations...");
    },
});
```

Usage:

```bash
cli db migrate up
cli db migrate down
```

#### Accessing Command Path

The `commandPath` is available through the `command` property in the execute function:

```typescript
cli.addCommand({
    name: "staging",
    commandPath: ["deploy"],
    execute: ({ command, logger }) => {
        // command.commandPath will be ["deploy"]
        // command.name will be "staging"
        const fullPath = command.commandPath ? [...command.commandPath, command.name].join(" ") : command.name;
        logger.info(`Executing command: ${fullPath}`);
    },
});
```

#### Options in Nested Commands

Nested commands support options just like regular commands:

```typescript
cli.addCommand({
    name: "up",
    commandPath: ["db", "migrate"],
    options: [
        {
            name: "force",
            type: Boolean,
            description: "Force migration even if already applied",
        },
    ],
    execute: ({ options, logger }) => {
        if (options.force) {
            logger.info("Forcing migration...");
        }
        logger.info("Running migrations...");
    },
});
```

Usage:

```bash
cli db migrate up --force
```

#### Calling Nested Commands Programmatically

Use `runtime.runCommand()` with the full command path (space-separated):

```typescript
cli.addCommand({
    name: "deploy-all",
    execute: async ({ runtime, logger }) => {
        logger.info("Deploying to all environments...");

        // Call nested commands programmatically
        await runtime.runCommand("deploy staging");
        await runtime.runCommand("deploy production");
    },
});
```

### Enhanced Error Handling

Error handling has been improved with better error types and validation.

#### Command Not Found Errors

```typescript
import { CommandNotFoundError } from "@visulima/cerebro";

// Before - Generic error
try {
    await cli.run();
} catch (error) {
    console.error("Error:", error.message);
}

// After - Specific error types
try {
    await cli.run();
} catch (error) {
    if (error instanceof CommandNotFoundError) {
        console.error(`Command not found: ${error.command}`);
        console.error(`Did you mean: ${error.alternatives.join(", ")}?`);
    }
}
```

### Migration Steps

#### 1. Update Package Configuration

Ensure your `package.json` uses ESM:

```json
{
    "name": "your-project",
    "version": "1.0.0",
    "type": "module",
    "engines": {
        "node": ">=20.19"
    }
}
```

#### 2. Update Imports

Replace CJS `require()` calls with ESM `import` statements:

```javascript
// Before
import { createCerebro } from "@visulima/cerebro";

// After
const { createCerebro } = require("@visulima/cerebro");
```

#### 3. Update Plugin Imports

Use granular plugin imports:

```javascript
// Before
import { errorHandlerPlugin } from "@visulima/cerebro";

// After
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
```

#### 4. Handle Async Context

Ensure functions using Cerebro are async when needed:

```typescript
// Before
function setupCLI() {
    const { createCerebro } = require("@visulima/cerebro");

    return createCerebro("my-app");
}

// After
async function setupCLI() {
    const { createCerebro } = await import("@visulima/cerebro");

    return createCerebro("my-app");
}
```

Or better, use static imports:

```typescript
import { createCerebro } from "@visulima/cerebro";

function setupCLI() {
    return createCerebro("my-app");
}
```

### Migration Issues & Solutions

#### 1. require() Calls No Longer Work

**Problem**: `require('@visulima/cerebro')` throws "module not found" error.

**Solution**: Use dynamic imports or convert to ESM:

```javascript
// Dynamic import for ESM modules from CJS
const { createCerebro } = await import("@visulima/cerebro");
```

#### 2. Plugin Imports Fail

**Problem**: Plugin imports from main package no longer work.

**Solution**: Use granular plugin imports:

```javascript
// Before
import { errorHandlerPlugin } from "@visulima/cerebro";

// After
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
```

#### 3. Async Context Required

**Problem**: Functions using Cerebro must be async when using dynamic imports.

**Solution**: Mark functions as async and await the import, or use static ESM imports:

```typescript
// Static imports (recommended)
import { createCerebro } from "@visulima/cerebro";

// Or dynamic imports
async function setupCLI() {
    const { createCerebro } = await import("@visulima/cerebro");

    return createCerebro("my-app");
}
```

### Verification Steps

1. **Test ESM imports**:

    ```javascript
    // test.mjs
    import { createCerebro } from "@visulima/cerebro";

    const cli = createCerebro("test-app");

    cli.addCommand({
        execute: ({ logger }) => {
            logger.info("ESM import successful");
        },
        name: "test",
    });

    await cli.run({ argv: ["test"] });
    ```

2. **Test plugin imports**:

    ```javascript
    // test-plugins.mjs
    import { createCerebro } from "@visulima/cerebro";
    import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
    import { runtimeVersionCheckPlugin } from "@visulima/cerebro/plugins/runtime-version-check";

    const cli = createCerebro("test-app");

    cli.addPlugin(errorHandlerPlugin());
    cli.addPlugin(runtimeVersionCheckPlugin());

    console.log("Plugin imports successful");
    ```

3. **Test dynamic imports from CJS**:

    ```javascript
    // test.cjs
    async function test() {
        const { createCerebro } = await import("@visulima/cerebro");
        const cli = createCerebro("test-app");

        cli.addCommand({
            execute: ({ logger }) => {
                logger.info("Dynamic import successful");
            },
            name: "test",
        });

        await cli.run({ argv: ["test"] });
    }

    test().catch(console.error);
    ```

## Migrating from Other CLI Libraries

### From Commander.js

Commander.js uses a different API structure. Here's how to migrate:

#### Commander.js Example

```javascript
const { Command } = require("commander");

const program = new Command();

program.name("my-app").description("My CLI application").version("1.0.0");

program
    .command("build")
    .description("Build the project")
    .option("-p, --production", "Build for production")
    .action((options) => {
        console.log("Building...", options.production);
    });

program.parse();
```

#### Cerebro Equivalent

```typescript
import { createCerebro } from "@visulima/cerebro";

const cli = createCerebro("my-app", {
    packageName: "my-app",
    packageVersion: "1.0.0",
});

cli.addCommand({
    description: "Build the project",
    execute: ({ logger, options }) => {
        logger.info("Building...", options.production);
    },
    name: "build",
    options: [
        {
            alias: "p",
            description: "Build for production",
            name: "production",
            type: Boolean,
        },
    ],
});

await cli.run();
```

### From Yargs

Yargs uses a builder pattern. Here's how to migrate:

#### Yargs Example

```javascript
const yargs = require("yargs");

yargs
    .command(
        "deploy",
        "Deploy the application",
        (yargs) =>
            yargs
                .option("env", {
                    alias: "e",
                    demandOption: true,
                    description: "Environment",
                    type: "string",
                })
                .option("force", {
                    alias: "f",
                    description: "Force deployment",
                    type: "boolean",
                }),
        (argv) => {
            console.log("Deploying to", argv.env);
        },
    )
    .help().argv;
```

#### Cerebro Equivalent

```typescript
import { createCerebro } from "@visulima/cerebro";

const cli = createCerebro("my-app");

cli.addCommand({
    description: "Deploy the application",
    execute: ({ logger, options }) => {
        logger.info(`Deploying to ${options.env}`);
    },
    name: "deploy",
    options: [
        {
            alias: "e",
            description: "Environment",
            name: "env",
            required: true,
            type: String,
        },
        {
            alias: "f",
            description: "Force deployment",
            name: "force",
            type: Boolean,
        },
    ],
});

await cli.run();
```

### From Meow

Meow uses a simpler API. Here's how to migrate:

#### Meow Example

```javascript
const meow = require("meow");

const cli = meow(
    `
    Usage
      $ my-app <input>

    Options
      --production, -p  Build for production

    Examples
      $ my-app build --production
`,
    {
        flags: {
            production: {
                alias: "p",
                type: "boolean",
            },
        },
    },
);

console.log(cli.input, cli.flags);
```

#### Cerebro Equivalent

```typescript
import { createCerebro } from "@visulima/cerebro";

const cli = createCerebro("my-app");

cli.setCommandSection({
    footer: "Examples:\n  $ my-app build --production",
    header: "My CLI Application",
});

cli.addCommand({
    argument: {
        name: "input",
        type: String,
    },
    execute: ({ argument, logger, options }) => {
        logger.info("Input:", argument[0]);
        logger.info("Production:", options.production);
    },
    name: "build",
    options: [
        {
            alias: "p",
            description: "Build for production",
            name: "production",
            type: Boolean,
        },
    ],
});

await cli.run();
```

## New Features in Recent Versions

### Programmatic Command Execution (v1.1.0+)

The `runCommand` method allows commands to call other commands programmatically:

```typescript
cli.addCommand({
    execute: async ({ logger, runtime }) => {
        logger.info("Building...");
        await runtime.runCommand("build", {
            argv: ["--production"],
        });

        logger.info("Testing...");
        await runtime.runCommand("test", {
            argv: ["--coverage"],
        });

        logger.info("Deploying...");
    },
    name: "deploy",
});
```

### Enhanced Error Handling

Error handling plugins provide structured error reporting:

```typescript
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

cli.addPlugin(
    errorHandlerPlugin({
        detailed: true,
        useCriticalLevel: false,
    }),
);
```

### Runtime Version Checking

Automatic runtime version checking:

```typescript
import { runtimeVersionCheckPlugin } from "@visulima/cerebro/plugins/runtime-version-check";

cli.addPlugin(
    runtimeVersionCheckPlugin({
        runtimes: {
            bun: { minVersion: 1 },
            node: { minVersion: 20 },
        },
    }),
);
```

## Migration Benefits

### ESM Migration Benefits

- **Better Performance**: ESM's improved module caching in Node.js 20.19+
- **Modern JavaScript**: Consistent module syntax across environments
- **Bundle Optimization**: Better tree-shaking and dead code elimination
- **Developer Experience**: Improved IDE support and error messages
- **Future-Proof**: Aligned with JavaScript ecosystem direction

### Granular Import Benefits

- **Smaller bundle sizes**: Only import what you need
- **Better tree-shaking**: Unused code is excluded from bundles
- **Clearer dependencies**: Explicit imports make dependencies obvious
- **Improved performance**: Reduced bundle size and faster loading

### Enhanced API Benefits

- **Type Safety**: Full TypeScript support with proper types
- **Extensibility**: Plugin system for adding functionality
- **Composability**: Commands can call other commands
- **Error Handling**: Structured error handling with helpful messages
- **Validation**: Built-in validation for options and arguments
