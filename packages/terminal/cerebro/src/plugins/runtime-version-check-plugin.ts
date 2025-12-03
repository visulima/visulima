import type { Plugin } from "../types/plugin";
import { exitProcess, getEnv, getVersions } from "../util/general/runtime-process";

/**
 * Safely parse major version from a version string.
 * @param versionString The version string to parse
 * @returns The major version number, or 0 if parsing fails
 */
const parseMajorVersion = (versionString: string | undefined | null): number => {
    if (!versionString || typeof versionString !== "string") {
        return 0;
    }

    const parts = versionString.split(".");

    if (parts.length === 0 || !parts[0]) {
        return 0;
    }

    const major = Number.parseInt(parts[0], 10);

    return Number.isNaN(major) ? 0 : major;
};

/**
 * Safely extract version from Node.js process.version.
 * @param processVersion The process.version string
 * @returns The version string without the "v" prefix, or empty string if invalid
 */
const extractNodeVersion = (processVersion: string | undefined): string => {
    if (!processVersion || typeof processVersion !== "string") {
        return "";
    }

    return processVersion.replace("v", "");
};

/**
 * Detect the current JavaScript runtime and its version.
 */
const detectRuntime = (): { major: number; type: RuntimeType; version: string } => {
    // Check for Bun
    // @ts-expect-error - Bun is a global in Bun runtime
    if (typeof Bun !== "undefined") {
        // @ts-expect-error - Bun.version exists in Bun runtime
        const version = (Bun.version as string) || "";
        const major = parseMajorVersion(version);

        return { major, type: "bun", version };
    }

    // Check for Deno
    // @ts-expect-error - Deno is a global in Deno runtime
    if (typeof Deno !== "undefined") {
        // @ts-expect-error - Deno.version exists in Deno runtime
        const version = (Deno.version?.deno as string) || "";
        const major = parseMajorVersion(version);

        return { major, type: "deno", version };
    }

    // Default to Node.js - use runtime abstraction
    const versions = getVersions();
    const nodeVersion = versions.node ?? "";
    const version = extractNodeVersion(nodeVersion);
    const major = parseMajorVersion(version);

    return { major, type: "node", version };
};

export type RuntimeType = "bun" | "deno" | "node";

export type RuntimeVersionRequirement = {
    /** Minimum version required */
    minVersion: number;
};

export type RuntimeVersionCheckOptions = {
    /** Runtime version requirements for specific runtimes */
    runtimes?: {
        /** Minimum Bun version requirement */
        bun?: RuntimeVersionRequirement;
        /** Minimum Deno version requirement */
        deno?: RuntimeVersionRequirement;
        /** Minimum Node.js version requirement */
        node?: RuntimeVersionRequirement;
    };
};

/**
 * Create a runtime version check plugin that supports Node.js, Bun, and Deno.
 * @param options Configuration for runtime version requirements
 * @returns Plugin instance that validates runtime version on initialization
 */
export const runtimeVersionCheckPlugin = (options: RuntimeVersionCheckOptions = {}): Plugin => {
    return {
        description: "Checks if the current runtime version meets the minimum requirement",
        init: async (context) => {
            const runtime = detectRuntime();

            // Get minimum version for detected runtime
            const defaultMinVersions: Record<RuntimeType, number> = {
                bun: 1,
                deno: 1,
                node: 18,
            };

            // Allow environment variable override for Node.js (backward compatibility)
            let envMinVersion: number | undefined;

            try {
                const env = getEnv();
                const envRaw = env.CEREBRO_MIN_NODE_VERSION;

                const parsed = envRaw === undefined ? undefined : Number.parseInt(envRaw, 10);

                envMinVersion = Number.isNaN(parsed as number) ? undefined : parsed;
            } catch {
                // getEnv() may not be available in some runtimes
                envMinVersion = undefined;
            }

            // Determine minimum version: specific runtime > environment variable (Node.js only) > default
            let minVersion: number;

            if (options.runtimes?.[runtime.type]?.minVersion !== undefined) {
                minVersion = (options.runtimes[runtime.type] as RuntimeVersionRequirement).minVersion;
            } else if (runtime.type === "node" && envMinVersion !== undefined) {
                minVersion = envMinVersion;
            } else {
                minVersion = defaultMinVersions[runtime.type];
            }

            if (runtime.major < minVersion) {
                context.logger.error(
                    `cerebro requires ${runtime.type} version ${minVersion} or higher. You have ${runtime.type} ${runtime.version}. Read our version support policy: https://github.com/visulima/visulima#supported-runtimes`,
                );

                // Use runtime-aware exit function
                exitProcess(1);
            }

            context.logger.debug(`Runtime version check passed: ${runtime.type} ${runtime.version} >= ${minVersion}`);
        },
        name: "runtime-version-check",

        version: "1.0.0",
    };
};
