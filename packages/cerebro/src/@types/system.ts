import type { ExecOptions, SpawnOptions } from "node:child_process";

import type { Options as ExecaOptions } from "execa";
import type { EnvObject, ProviderInfo, ProviderName, RuntimeInfo } from "std-env";

/**
 * Returns the number of milliseconds from when the timer started.
 */
type Timer = () => number;

export interface System {
    env: EnvObject;

    /**
     * Executes a command via execa.
     */
    exec: (command: string, options?: ExecaOptions) => Promise<string>;
    /** Detect if stdout.TTY is available */
    hasTTY: boolean;
    /** Detect if global `window` object is available */
    hasWindow: boolean;
    isBun: boolean;

    /** Detect if `CI` environment variable is set or a provider CI detected */
    isCI: boolean;
    /** Color Support */
    isColorSupported: boolean;

    /** Detect if `DEBUG` environment variable is set */
    isDebug: boolean;
    isDeno: boolean;
    /** Detect if `NODE_ENV` environment variable is `dev` or `development` */
    isDevelopment: boolean;
    isEdgeLight: boolean;

    isFastly: boolean;
    isLagon: boolean;
    /** Detect if process.platform is Linux */
    isLinux: boolean;
    /** Detect if process.platform is macOS (darwin kernel) */
    isMacOS: boolean;
    /** Detect if MINIMAL environment variable is set, running in CI or test or TTY is unavailable */
    isMinimal: boolean;
    isNetlify: boolean;
    isNode: boolean;
    /** Detect if `NODE_ENV` environment variable is `production` */
    isProduction: boolean;
    /** Detect if `NODE_ENV` environment variable is `test` */
    isTest: boolean;
    /** Detect if process.platform is Windows */
    isWindows: boolean;
    isWorkerd: boolean;
    nodeENV: string;
    nodeMajorVersion: number | null;
    /** Node.js versions */
    nodeVersion: string | null;
    platform: NodeJS.Platform;
    provider: ProviderName;
    /** Current provider info */
    providerInfo: ProviderInfo;

    /**
     * Runs a command and returns stdout as a trimmed string.
     */

    run: (command: string, options?: Partial<ExecOptions & { trim: boolean }>) => Promise<string>;
    runtime: string;
    runtimeInfo: RuntimeInfo | undefined;

    /**
     * Spawns a command via crosspawn.
     */
    spawn: (
        command: string,
        options?: SpawnOptions,
    ) => Promise<{
        error?: Error;
        status: number | null;
        stdout: string | null | undefined;
    }>;
    /**
     * Returns a timer function that starts from this moment. Calling
     * this function will return the number of milliseconds from when
     * it was started.
     */
    startTimer: () => Timer;
    /**
     * Uses node-which to find out where the command lines.
     */
    which: (command: string) => string | null;
}

export type StringOrBuffer = Buffer | string;

export interface CerebroError extends Error {
    stderr?: StringOrBuffer;
    stdout?: StringOrBuffer;
}
