/**
 * Built-in monorepo template — scaffolds a complete pnpm workspace.
 *
 * Creates:
 * - Root package.json with workspace scripts
 * - pnpm-workspace.yaml
 * - .gitignore, .editorconfig
 * - apps/ and packages/ directories
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { info, success } from "../../../output";
import type { ExecutionContext } from "./types";

// ── Template files ────────────────────────────────────────────────

const rootPackageJson = (name: string, pmName: string): string =>
    JSON.stringify(
        {
            name,
            version: "0.0.0",
            private: true,
            type: "module",
            scripts: {
                build: "vis run build",
                dev: "vis run dev",
                lint: "vis run lint",
                test: "vis run test",
            },
            devDependencies: {
                "@visulima/vis": "latest",
            },
            packageManager: `${pmName}@latest`,
        },
        null,
        4,
    ) + "\n";

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

const readmeMd = (name: string, pmName: string): string => `# ${name}

A monorepo powered by [vis](https://visulima.com/packages/vis).

## Getting Started

\`\`\`bash
# Install dependencies
${pmName} install

# Run all apps in development mode
${pmName} dev

# Build all packages
${pmName} build

# Run tests
${pmName} test
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

export const executeMonorepoTemplate = (context: ExecutionContext): number => {
    const { pm, projectName, targetDir } = context;

    info("Scaffolding monorepo workspace...");

    // Create directory structure
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(join(targetDir, "apps"), { recursive: true });
    mkdirSync(join(targetDir, "packages"), { recursive: true });

    // Write root files
    writeFileSync(join(targetDir, "package.json"), rootPackageJson(projectName, pm.name));
    success("Created package.json");

    writeFileSync(join(targetDir, "pnpm-workspace.yaml"), pnpmWorkspaceYaml());
    success("Created pnpm-workspace.yaml");

    writeFileSync(join(targetDir, ".gitignore"), gitignore());
    success("Created .gitignore");

    writeFileSync(join(targetDir, ".editorconfig"), editorconfig());
    success("Created .editorconfig");

    writeFileSync(join(targetDir, "README.md"), readmeMd(projectName, pm.name));
    success("Created README.md");

    // Add .gitkeep files so empty directories are tracked
    writeFileSync(join(targetDir, "apps", ".gitkeep"), "");
    writeFileSync(join(targetDir, "packages", ".gitkeep"), "");

    return 0;
};
