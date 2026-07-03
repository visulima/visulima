import { createInterface } from "node:readline";

import type { InstallerInfo, PmInfo } from "../pm/pm-runner";
import { detectPm, runAdd } from "../pm/pm-runner";

/**
 * Optional peer-dep packages used by `vis ai heal accept`. We don't ship
 * these as direct dependencies because:
 *
 * - Most users never hit the auto-commit codepath (it's CI-only) and
 *   shouldn't pay ~400 KB of Octokit/Gitbeaker on every `vis` install.
 * - A consumer who only commits to GitHub doesn't need Gitbeaker, and
 *   vice versa.
 *
 * Instead, we lazy-import on demand. If the import misses we either
 * prompt the user to install (interactive shell) or surface an
 * actionable error with the install command (CI / non-TTY).
 */
export type OptionalSdk = "@gitbeaker/rest" | "@octokit/rest";

export interface LoadSdkOptions {
    /** Override the dynamic `import()` call for tests. Defaults to native `import(sdk)`. */
    importImpl?: (sdk: OptionalSdk) => Promise<unknown>;

    /**
     * Override TTY detection for tests. Defaults to checking
     * `process.stdout.isTTY` and the absence of `CI`.
     */
    interactive?: boolean;
    /** Override stdin/stdout for the prompt. Defaults to process streams. */
    prompt?: (question: string) => Promise<boolean>;
    /** Override package-manager runner for tests. */
    runInstall?: (sdk: OptionalSdk, workspaceRoot: string) => Promise<{ exitCode: number }>;
    /** Workspace root for the install. Defaults to `process.cwd()`. */
    workspaceRoot?: string;
}

interface LoadedModule<T> {
    [key: string]: unknown;
    /** Default export (or the namespace itself when no default). */
    default?: T;
}

const isInteractive = (): boolean => Boolean(process.stdout.isTTY) && process.env.CI !== "true";

const defaultPrompt = (question: string): Promise<boolean> =>
    new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stderr });

        rl.question(`${question} (Y/n) `, (answer) => {
            rl.close();
            const trimmed = answer.trim().toLowerCase();

            // Default to yes — the user explicitly invoked a command that
            // needs the SDK; saying nothing should mean "go ahead."
            resolve(trimmed === "" || trimmed === "y" || trimmed === "yes");
        });
    });

const defaultRunInstall = (sdk: OptionalSdk, workspaceRoot: string): Promise<{ exitCode: number }> => {
    // Use the workspace's own package manager so the SDK lands in the
    // user's lockfile (so a fresh `pnpm install` re-installs it on the
    // next CI run). We deliberately don't write to vis's own
    // node_modules — vis is typically a transitive dep of the user's
    // project.
    const pm: InstallerInfo | PmInfo = detectPm(workspaceRoot);

    const exitCode = runAdd(
        pm,
        {
            exact: false,
            filter: [],
            global: false,
            optional: false,
            packages: [sdk],
            peer: false,
            // Save into "dependencies" (saveDev=false) — the user wants
            // this available in CI without `--include=dev` toggling.
            // The SDK is a runtime dep of `vis ai heal accept`,
            // conceptually.
            saveDev: false,
            workspace: false,
            workspaceRoot: false,
        },
        workspaceRoot,

        console,
    );

    return Promise.resolve({ exitCode });
};

const installCommandFor = (sdk: OptionalSdk): string => `pnpm add ${sdk}`;

// Static dispatch so the bundler can analyze each import() and mark
// the SDK as external instead of trying to resolve a free variable.
// Both targets are declared as optional peerDependencies, so the
// runtime "module not found" branch below is the expected miss path
// when a consumer hasn't installed the SDK.
const defaultImport = (sdk: OptionalSdk): Promise<unknown> => {
    if (sdk === "@gitbeaker/rest") {
        return import("@gitbeaker/rest");
    }

    return import("@octokit/rest");
};

/**
 * Lazy-loads an optional peer-dep SDK.
 *
 * Flow:
 * 1. Try `await import(sdk)`.
 * 2. On `ERR_MODULE_NOT_FOUND`:
 *    a. Interactive shell → prompt to install. If accepted, install via
 *       the workspace's package manager and re-import.
 *    b. Non-interactive (CI) → throw with a copy-pasteable install
 *       command in the message.
 * 3. Any other import error bubbles unchanged.
 *
 * Returns the loaded module so the caller can pull the named exports it
 * needs. The caller is responsible for picking the right export shape
 * (Octokit ships a class as a named export; Gitbeaker ships a class as
 * a named export — neither has a default).
 */
export const loadOptionalSdk = async <T = unknown>(sdk: OptionalSdk, options: LoadSdkOptions = {}): Promise<LoadedModule<T>> => {
    const interactive = options.interactive ?? isInteractive();
    const prompt = options.prompt ?? defaultPrompt;
    const runInstall = options.runInstall ?? defaultRunInstall;
    const importImpl = options.importImpl ?? defaultImport;
    const workspaceRoot = options.workspaceRoot ?? process.cwd();

    try {
        return (await importImpl(sdk)) as LoadedModule<T>;
    } catch (error: unknown) {
        const { code } = error as NodeJS.ErrnoException;

        // Anything other than "module not found" — bubble. A failed-to-
        // parse SDK is the user's broken install, not something we can
        // auto-fix.
        if (code !== "ERR_MODULE_NOT_FOUND" && code !== "MODULE_NOT_FOUND") {
            throw error;
        }
    }

    if (!interactive) {
        throw new Error(
            `${sdk} is not installed. \`vis ai heal accept\` needs it to talk to the host. Install it in your repo first:\n  ${installCommandFor(sdk)}`,
        );
    }

    const accepted = await prompt(`${sdk} isn't installed. Install it now?`);

    if (!accepted) {
        throw new Error(`${sdk} install declined. Re-run \`vis ai heal accept\` after installing manually:\n  ${installCommandFor(sdk)}`);
    }

    const result = await runInstall(sdk, workspaceRoot);

    if (result.exitCode !== 0) {
        throw new Error(`Install of ${sdk} failed (exit ${String(result.exitCode)}). Install manually and retry:\n  ${installCommandFor(sdk)}`);
    }

    // Re-import after install. ESM caches by specifier so a stale miss
    // could in theory be cached, but Node clears the negative cache on
    // disk-change for dynamic imports — confirmed in our smoke tests.
    return (await importImpl(sdk)) as LoadedModule<T>;
};
