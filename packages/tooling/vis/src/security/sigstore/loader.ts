import { createInterface } from "node:readline";

import type { InstallerInfo, PmInfo } from "../../pm/pm-runner";
import { detectPm, runAdd } from "../../pm/pm-runner";

/**
 * `sigstore` is an optional peer dep, not a direct dependency, because:
 *
 * - Keyless signing/attestation is opt-in. Most `vis` invocations
 *   (audit, run, cache) never touch it, and shouldn't pay the
 *   transitive weight (tuf-js plus the sigstore bundle and protobuf
 *   machinery) on every install.
 * - Verification of an existing `.sigstore` bundle still needs the same
 *   package, but a consumer who only verifies inbound provenance via
 *   the npm-registry marshalls never imports it at all.
 *
 * We lazy-import on demand. On a miss we either prompt to install
 * (interactive shell) or surface an actionable error carrying the
 * install command (CI / non-TTY).
 */

/**
 * The subset of the `sigstore` umbrella API that vis uses.
 *
 * `sign`   — DSSE-wrap + keyless-sign a payload, returns a serialized bundle.
 * `attest` — build an in-toto/DSSE attestation for a payload + predicate.
 * `verify` — verify a serialized bundle (optionally against an identity).
 */
export interface SigstoreModule {
    attest: (payload: Buffer, payloadType: string, options?: unknown) => Promise<unknown>;
    sign: (payload: Buffer, options?: unknown) => Promise<unknown>;
    verify: (bundle: unknown, payload?: Buffer, options?: unknown) => Promise<void>;
}

export interface LoadSigstoreOptions {
    /** Override the dynamic `import()` call for tests. Defaults to native `import("sigstore")`. */
    importImpl?: () => Promise<unknown>;

    /**
     * Override TTY detection for tests. Defaults to checking
     * `process.stdout.isTTY` and the absence of `CI`.
     */
    interactive?: boolean;
    /** Override stdin/stdout for the prompt. Defaults to process streams. */
    prompt?: (question: string) => Promise<boolean>;
    /** Override package-manager runner for tests. */
    runInstall?: (workspaceRoot: string) => Promise<{ exitCode: number }>;
    /** Workspace root for the install. Defaults to `process.cwd()`. */
    workspaceRoot?: string;
}

const SIGSTORE_PKG = "sigstore";

const isInteractive = (): boolean => Boolean(process.stdout.isTTY) && process.env.CI !== "true";

const defaultPrompt = (question: string): Promise<boolean> =>
    new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stderr });

        rl.question(`${question} (Y/n) `, (answer) => {
            rl.close();
            const trimmed = answer.trim().toLowerCase();

            // Default to yes — the user explicitly invoked an attest
            // command that needs sigstore; silence means "go ahead."
            resolve(trimmed === "" || trimmed === "y" || trimmed === "yes");
        });
    });

const defaultRunInstall = (workspaceRoot: string): Promise<{ exitCode: number }> => {
    // Install into the workspace's own package manager so the dep lands
    // in the user's lockfile and a fresh CI `install` re-fetches it. We
    // don't write to vis's own node_modules — vis is typically a
    // transitive dep of the user's project.
    const pm: InstallerInfo | PmInfo = detectPm(workspaceRoot);

    const exitCode = runAdd(
        pm,
        {
            exact: false,
            filter: [],
            global: false,
            optional: false,
            packages: [SIGSTORE_PKG],
            peer: false,
            saveDev: true,
            workspace: false,
            workspaceRoot: false,
        },
        workspaceRoot,

        console,
    );

    return Promise.resolve({ exitCode });
};

/**
 * Resolve-only presence check for the optional `sigstore` peer dep.
 * Uses `import.meta.resolve`, which locates the module without
 * evaluating it — so a startup notice costs nothing when the package
 * is absent and doesn't pay sigstore's transitive load when it's
 * present (the real sign/verify paths lazy-import it later).
 */
export const isSigstoreInstalled = (): boolean => {
    try {
        import.meta.resolve(SIGSTORE_PKG);

        return true;
    } catch {
        return false;
    }
};

export const installCommandFor = (workspaceRoot: string): string => {
    let pmName = "pnpm";

    try {
        pmName = detectPm(workspaceRoot).name;
    } catch {
        // detectPm can throw outside a recognized workspace; the default
        // string is only advisory text, so fall back rather than mask
        // the real "sigstore missing" error.
    }

    switch (pmName) {
        case "bun": {
            return `bun add -d ${SIGSTORE_PKG}`;
        }
        case "npm": {
            return `npm install -D ${SIGSTORE_PKG}`;
        }
        case "yarn": {
            return `yarn add -D ${SIGSTORE_PKG}`;
        }
        default: {
            return `pnpm add -D ${SIGSTORE_PKG}`;
        }
    }
};

// A standalone import() so the bundler marks `sigstore` external. The
// package is an optional peerDependency, so the "module not found"
// branch below is the expected miss when a consumer hasn't installed it.
const defaultImport = (): Promise<unknown> => import("sigstore");

/**
 * Lazy-loads the optional `sigstore` peer dep.
 *
 * Flow:
 * 1. Try `await import("sigstore")`.
 * 2. On `ERR_MODULE_NOT_FOUND`:
 *    a. Interactive shell → prompt to install, then re-import.
 *    b. Non-interactive (CI) → throw with a copy-pasteable install command.
 * 3. Any other import error bubbles unchanged.
 */
export const loadOptionalSigstore = async (options: LoadSigstoreOptions = {}): Promise<SigstoreModule> => {
    const interactive = options.interactive ?? isInteractive();
    const prompt = options.prompt ?? defaultPrompt;
    const runInstall = options.runInstall ?? defaultRunInstall;
    const importImpl = options.importImpl ?? defaultImport;
    const workspaceRoot = options.workspaceRoot ?? process.cwd();

    const installCommand = installCommandFor(workspaceRoot);

    try {
        return (await importImpl()) as SigstoreModule;
    } catch (error: unknown) {
        const { code, message } = error as NodeJS.ErrnoException;
        const isModuleMissing = code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";

        // A missing *transitive* dep of sigstore (tuf-js, protobuf, …)
        // also throws ERR_MODULE_NOT_FOUND. Reporting that as "sigstore
        // not installed" would send the user down a reinstall path that
        // can't fix it — bubble unless the missing module is sigstore.
        if (!isModuleMissing || !message.includes(SIGSTORE_PKG)) {
            throw error;
        }
    }

    if (!interactive) {
        throw new Error(
            `${SIGSTORE_PKG} is not installed. \`vis attest\` needs it for keyless signing/verification. Install it in your repo first:\n  ${installCommand}`,
        );
    }

    const accepted = await prompt(`${SIGSTORE_PKG} isn't installed. Install it now?`);

    if (!accepted) {
        throw new Error(`${SIGSTORE_PKG} install declined. Re-run \`vis attest\` after installing manually:\n  ${installCommand}`);
    }

    const result = await runInstall(workspaceRoot);

    if (result.exitCode !== 0) {
        throw new Error(`Install of ${SIGSTORE_PKG} failed (exit ${String(result.exitCode)}). Install manually and retry:\n  ${installCommand}`);
    }

    return (await importImpl()) as SigstoreModule;
};
