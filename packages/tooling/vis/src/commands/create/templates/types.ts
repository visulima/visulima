export type TemplateType = "builtin:app" | "builtin:generator" | "builtin:library" | "builtin:monorepo" | "remote:bundled" | "remote:git" | "remote:npm";

export interface TemplateConfig {
    /** Extra CLI arguments forwarded to the template runner. */
    args: string[];

    /** The npm package name (for remote:npm), git URL (for remote:git), or package tarball URL (for remote:bundled). */
    source: string;

    /** Package-relative directory to scaffold from (for remote:bundled, already validated). */
    subdir?: string;

    /** What kind of template this is. */
    type: TemplateType;
}

/** Create config from vis.config.ts — full shape matching VisConfig.create. */
export interface CreateConfig {
    auth?: string;
    defaultEditor?: "vscode";
    defaultPm?: "bun" | "deno" | "npm" | "pnpm" | "yarn";
    defaultProvider?: "bitbucket" | "github" | "gitlab" | "sourcehut";
    /** Template used by a bare `vis create`. Accepts any template input, including `@org` / `@org:name`. */
    defaultTemplate?: string;
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
