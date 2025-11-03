# Nested Commands Example

This example demonstrates how to use nested commands (subcommands) in Cerebro, allowing you to create hierarchical command structures like `cli deploy staging` or `cli db migrate up`.

## Features Demonstrated

- **Basic nested commands** - Simple subcommands under a parent path
- **Multi-level nesting** - Commands nested multiple levels deep
- **Nested commands with options** - Options work seamlessly with nested commands
- **Mixing flat and nested commands** - Same command name in different contexts
- **Programmatic execution** - Calling nested commands from other commands

## Run

### Using npm scripts:

```bash
pnpm start              # Show help
pnpm deploy-staging     # Deploy to staging
pnpm deploy-prod        # Deploy to production
pnpm migrate-up         # Run migrations
pnpm migrate-down       # Rollback migrations
pnpm migrate-status     # Show migration status
pnpm docker-build       # Build Docker image
pnpm deploy-all         # Deploy to all environments
```

### Using node directly:

```bash
# Show help - see all nested commands
node cli.js help

# Basic nested commands
node cli.js deploy staging
node cli.js deploy production

# Nested commands with options
node cli.js deploy production --dry-run
node cli.js deploy production --tag v1.0.0
node cli.js deploy production -t v2.0.0 --dry-run

# Multi-level nested commands
node cli.js db migrate up
node cli.js db migrate down
node cli.js db migrate down --steps 3
node cli.js db migrate status

# Flat vs nested commands (same name, different path)
node cli.js build                    # Flat command
node cli.js docker build             # Nested command
node cli.js docker build --tag v1.0  # Nested command with options

# Programmatic command execution
node cli.js deploy-all
```

## Examples Explained

### Basic Nested Commands

```javascript
cli.addCommand({
    name: "staging",
    commandPath: ["deploy"], // Creates: cli deploy staging
    description: "Deploy to staging environment",
    execute: ({ logger }) => {
        logger.info("Deploying to staging...");
    },
});
```

### Multi-Level Nesting

```javascript
cli.addCommand({
    name: "up",
    commandPath: ["db", "migrate"], // Creates: cli db migrate up
    description: "Run database migrations forward",
    execute: ({ logger }) => {
        logger.info("Running migrations...");
    },
});
```

### Nested Commands with Options

```javascript
cli.addCommand({
    name: "production",
    commandPath: ["deploy"],
    options: [
        {
            name: "dry-run",
            type: Boolean,
            description: "Show what would be deployed",
        },
        {
            name: "tag",
            alias: "t",
            type: String,
            description: "Deployment tag",
        },
    ],
    execute: ({ logger, options }) => {
        // Note: kebab-case options are converted to camelCase
        // So "dry-run" becomes "dryRun" in the options object
        if (options.dryRun) {
            logger.info("Dry run mode");
        }
    },
});
```

### Calling Nested Commands Programmatically

```javascript
cli.addCommand({
    name: "deploy-all",
    execute: async ({ runtime, logger }) => {
        // Call nested commands using full path
        await runtime.runCommand("deploy staging");
        await runtime.runCommand("deploy production", {
            argv: ["--dry-run"],
        });
    },
});
```

## Command Structure

```
deploy-tool
├── build                    (flat command)
├── deploy
│   ├── staging              (nested: deploy staging)
│   └── production           (nested: deploy production)
├── db
│   └── migrate
│       ├── up               (nested: db migrate up)
│       ├── down             (nested: db migrate down)
│       └── status           (nested: db migrate status)
├── docker
│   └── build                (nested: docker build)
└── deploy-all               (flat command that calls nested commands)
```

## Help Output

When you run `node cli.js help`, nested commands are displayed with their full path:

```
Available Commands
  build                    Build the project
  deploy staging          Deploy to staging environment
  deploy production       Deploy to production environment
  db migrate up           Run database migrations forward
  db migrate down         Rollback database migrations
  db migrate status       Show migration status
  docker build            Build Docker image
  deploy-all              Deploy to all environments
```

## Key Points

1. **Command Path**: Use `commandPath` array to define the parent path
2. **Full Path**: Commands are invoked using the full path: `cli <path> <name>`
3. **Options Work**: All standard command features (options, arguments, etc.) work with nested commands
4. **Programmatic Calls**: Use `runtime.runCommand("deploy staging")` to call nested commands
5. **Help Display**: Nested commands automatically show their full path in help output
