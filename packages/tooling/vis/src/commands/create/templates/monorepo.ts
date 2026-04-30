/**
 * Built-in monorepo template — scaffolds a complete pnpm workspace.
 *
 * Creates:
 * - Root package.json with workspace scripts
 * - pnpm-workspace.yaml
 * - .gitignore, .editorconfig
 * - apps/ and packages/ directories
 */

import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { pail } from "../../../io/logger";
import type { ExecutionContext } from "./types";

// ── Template files ────────────────────────────────────────────────

// The monorepo template always uses pnpm since it generates pnpm-workspace.yaml.
const rootPackageJson = (name: string): string =>
    `${JSON.stringify(
        {
            devDependencies: {
                "@visulima/vis": "latest",
            },
            name,
            packageManager: "pnpm@latest",
            private: true,
            scripts: {
                build: "vis run build",
                dev: "vis run dev",
                lint: "vis run lint",
                test: "vis run test",
            },
            type: "module",
            version: "0.0.0",
        },
        null,
        4,
    )}\n`;

const pnpmWorkspaceYaml = (): string => `packages:
  - "apps/*"
  - "packages/*"
`;

const gitignore = (): string => `# Dependencies
node_modules/

# Build output
dist/
.output/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Cache
.turbo/
.cache/
`;

const editorconfig = (): string => `root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{yml,yaml}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
`;

const readmeMd = (name: string): string => `# ${name}

A monorepo powered by [vis](https://visulima.com/packages/vis).

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test
\`\`\`

## Structure

\`\`\`
├── apps/          # Applications
├── packages/      # Shared packages & libraries
├── pnpm-workspace.yaml
└── package.json
\`\`\`
`;

// ── Executor ──────────────────────────────────────────────────────

/**
 * Scaffold a pnpm monorepo workspace with apps/ and packages/ directories.
 * @param context Execution context with project name, target directory, and PM info.
 * @returns Exit code (0 = success).
 */
export const executeMonorepoTemplate = (context: ExecutionContext): number => {
    const { projectName, targetDir } = context;

    pail.info("Scaffolding monorepo workspace...");

    // Create directory structure
    ensureDirSync(targetDir);
    ensureDirSync(join(targetDir, "apps"));
    ensureDirSync(join(targetDir, "packages"));

    // Write root files
    writeFileSync(join(targetDir, "package.json"), rootPackageJson(projectName));
    pail.success("Created package.json");

    writeFileSync(join(targetDir, "pnpm-workspace.yaml"), pnpmWorkspaceYaml());
    pail.success("Created pnpm-workspace.yaml");

    writeFileSync(join(targetDir, ".gitignore"), gitignore());
    pail.success("Created .gitignore");

    writeFileSync(join(targetDir, ".editorconfig"), editorconfig());
    pail.success("Created .editorconfig");

    writeFileSync(join(targetDir, "README.md"), readmeMd(projectName));
    pail.success("Created README.md");

    // Add .gitkeep files so empty directories are tracked
    writeFileSync(join(targetDir, "apps", ".gitkeep"), "");
    writeFileSync(join(targetDir, "packages", ".gitkeep"), "");

    return 0;
};
