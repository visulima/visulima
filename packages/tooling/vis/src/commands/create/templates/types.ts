/**
 * Core type definitions for the `vis create` scaffolding system.
 */

/** The kind of template being scaffolded. */
export type TemplateType = "builtin:app" | "builtin:generator" | "builtin:library" | "builtin:monorepo" | "remote:git" | "remote:npm";

/** Resolved information about a template after discovery. */
export interface TemplateConfig {
    /** Extra CLI arguments forwarded to the template runner. */
    args: string[];

    /** The npm package name (for remote:npm) or git URL (for remote:git). */
    source: string;

    /** What kind of template this is. */
    type: TemplateType;
}

/** Create config from vis.config.ts — full shape matching VisConfig.create. */
export interface CreateConfig {
    auth?: string;
    defaultEditor?: "vscode";
    defaultPm?: "bun" | "deno" | "npm" | "pnpm" | "yarn";
    defaultProvider?: "bitbucket" | "github" | "gitlab" | "sourcehut";
    gitInit?: boolean;
    install?: boolean;
    preferOffline?: boolean;
    registry?: false | string;
    templates?: Record<string, string>;
}

/** Runtime context passed to every template executor. */
export interface ExecutionContext {
    /** Create config from vis.config.ts. */
    createConfig?: CreateConfig;

    /** Working directory (workspace root or cwd). */
    cwd: string;

    /** Whether we are inside an existing monorepo workspace. */
    inMonorepo: boolean;

    /** Console-compatible logger from Cerebro toolbox. */
    logger: Console;

    /** Detected package manager. */
    pm: { name: "bun" | "deno" | "npm" | "pnpm" | "yarn"; version: string };

    /** The validated npm-safe project name. */
    projectName: string;

    /** Absolute path to the target directory. */
    targetDir: string;
}
