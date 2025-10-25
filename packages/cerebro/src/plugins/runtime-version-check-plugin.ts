import type { Plugin } from "../@types/plugin";

/**
 * Detect the current JavaScript runtime and its version.
 */
const detectRuntime = (): { major: number; type: RuntimeType; version: string } => {
    // Check for Bun
    // @ts-expect-error - Bun is a global in Bun runtime
    if (typeof Bun !== "undefined") {
        // @ts-expect-error - Bun.version exists in Bun runtime
        const version = Bun.version as string;
        const major = Number(version.split(".")[0]);

        return { major, type: "bun", version };
    }

    // Check for Deno
    // @ts-expect-error - Deno is a global in Deno runtime
    if (typeof Deno !== "undefined") {
        // @ts-expect-error - Deno.version exists in Deno runtime
        const version = Deno.version.deno as string;
        const major = Number(version.split(".")[0]);

        return { major, type: "deno", version };
    }

    // Default to Node.js
    const version = process.version.replace("v", "");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const major = Number(/v([^.]+)/.exec(process.version)![1]);

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
            const envMinVersion = process.env.CEREBRO_MIN_NODE_VERSION ? Number(process.env.CEREBRO_MIN_NODE_VERSION) : undefined;

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
                // eslint-disable-next-line unicorn/no-process-exit
                process.exit(1);
            }

            context.logger.debug(`Runtime version check passed: ${runtime.type} ${runtime.version} >= ${minVersion}`);
        },
        name: "runtime-version-check",

        version: "1.0.0",
    };
};
