// packages/cerebro/examples/nested-commands/cli.js
// Example demonstrating nested commands (subcommands) in Cerebro
import { Cerebro } from "@visulima/cerebro";

const cli = new Cerebro("deploy-tool", {
    packageName: "deploy-tool",
    packageVersion: "1.0.0",
});

// Flat command - for comparison
cli.addCommand({
    name: "build",
    description: "Build the project",
    execute: ({ logger }) => {
        logger.info("Building project...");
    },
});

// Basic nested commands - deploy staging/production
cli.addCommand({
    name: "staging",
    commandPath: ["deploy"],
    description: "Deploy to staging environment",
    execute: ({ logger }) => {
        logger.info("🚀 Deploying to staging environment...");
        logger.info("✓ Deployment complete!");
    },
});

cli.addCommand({
    name: "production",
    commandPath: ["deploy"],
    description: "Deploy to production environment",
    options: [
        {
            name: "dry-run",
            type: Boolean,
            description: "Show what would be deployed without deploying",
        },
        {
            name: "tag",
            alias: "t",
            type: String,
            description: "Deployment tag/version",
        },
    ],
    execute: ({ logger, options }) => {
        // Note: kebab-case options are converted to camelCase
        if (options.dryRun) {
            logger.info("🔍 Dry run: Would deploy to production");
            if (options.tag) {
                logger.info(`   Tag: ${options.tag}`);
            }
            return;
        }

        logger.info("🚀 Deploying to production environment...");
        if (options.tag) {
            logger.info(`   Tag: ${options.tag}`);
        }
        logger.info("✓ Deployment complete!");
    },
});

// Multi-level nested commands - db migrate
cli.addCommand({
    name: "up",
    commandPath: ["db", "migrate"],
    description: "Run database migrations forward",
    execute: ({ logger }) => {
        logger.info("📊 Running database migrations...");
        logger.info("✓ Migrations applied successfully!");
    },
});

cli.addCommand({
    name: "down",
    commandPath: ["db", "migrate"],
    description: "Rollback database migrations",
    options: [
        {
            name: "steps",
            alias: "s",
            type: Number,
            description: "Number of migrations to rollback",
            defaultValue: 1,
        },
    ],
    execute: ({ logger, options }) => {
        logger.info(`📊 Rolling back ${options.steps} migration(s)...`);
        logger.info("✓ Rollback complete!");
    },
});

cli.addCommand({
    name: "status",
    commandPath: ["db", "migrate"],
    description: "Show migration status",
    execute: ({ logger }) => {
        logger.info("📊 Migration status:");
        logger.info("   ✓ migration_001_users.js");
        logger.info("   ✓ migration_002_posts.js");
        logger.info("   ⏳ migration_003_comments.js (pending)");
    },
});

// Nested command with same name as flat command (different path)
cli.addCommand({
    name: "build",
    commandPath: ["docker"],
    description: "Build Docker image",
    options: [
        {
            name: "tag",
            alias: "t",
            type: String,
            description: "Docker image tag",
            defaultValue: "latest",
        },
    ],
    execute: ({ logger, options }) => {
        logger.info(`🐳 Building Docker image with tag: ${options.tag}`);
        logger.info("✓ Docker image built successfully!");
    },
});

// Command that calls nested commands programmatically
cli.addCommand({
    name: "deploy-all",
    description: "Deploy to all environments",
    execute: async ({ runtime, logger }) => {
        logger.info("Deploying to all environments...\n");

        logger.info("1. Deploying to staging...");
        await runtime.runCommand("deploy staging");

        logger.info("\n2. Deploying to production...");
        await runtime.runCommand("deploy production", {
            argv: ["--dry-run"],
        });

        logger.info("\n✓ All deployments initiated!");
    },
});

await cli.run();

