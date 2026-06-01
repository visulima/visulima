import type { Meta, Processor } from "../types";

/**
 * Detected environment information.
 *
 * Contains runtime environment details that are automatically detected
 * from environment variables and process information.
 */
interface EnvironmentInfo {
    /** Git commit hash or short SHA */
    commit?: string;
    /** Runtime environment (e.g., "production", "development", "test") */
    environment?: string;
    /** Hostname of the machine */
    hostname?: string;
    /** Process ID */
    pid?: number;
    /** Cloud region (e.g., "us-east-1") */
    region?: string;
    /** Application/service name */
    service?: string;
    /** Application version */
    version?: string;
}

/**
 * Environment processor configuration options.
 */
interface EnvironmentProcessorOptions {
    /**
     * Whether to include the hostname. Defaults to false.
     */
    includeHostname?: boolean;

    /**
     * Whether to include the process ID. Defaults to false.
     */
    includePid?: boolean;

    /**
     * Static environment info to use instead of or in addition to auto-detection.
     * Values provided here take precedence over auto-detected values.
     */
    overrides?: Partial<EnvironmentInfo>;
}

/**
 * Detects the runtime environment from environment variables.
 *
 * Checks common environment variable patterns used by various hosting
 * platforms (Vercel, AWS, GCP, Heroku, Railway, Fly.io, Render, etc.)
 * to automatically determine service name, version, environment, region,
 * and commit hash.
 * @returns Detected environment information
 */
const detectEnvironment = (): EnvironmentInfo => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- process may not exist in browser/edge environments
    if (typeof process === "undefined" || !process.env) {
        return {};
    }

    const { env } = process;
    const info: EnvironmentInfo = {
        /* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing -- env vars may be undefined or empty at runtime */
        // Commit hash
        commit:
            env.COMMIT_SHA ||
            env.GIT_COMMIT ||
            env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
            env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ||
            env.RENDER_GIT_COMMIT?.slice(0, 7) ||
            env.HEROKU_SLUG_COMMIT?.slice(0, 7) ||
            env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ||
            undefined,
        // Environment / Node env
        environment: env.NODE_ENV || env.ENVIRONMENT || env.APP_ENV || undefined,
        // Hostname
        hostname: env.HOSTNAME || env.HOST || undefined,
        // PID
        pid: process.pid,
        // Region (including GCP Cloud Functions FUNCTION_REGION and GOOGLE_CLOUD_REGION)
        region:
            env.AWS_REGION ||
            env.VERCEL_REGION ||
            env.FLY_REGION ||
            env.RENDER_REGION ||
            env.CF_REGION ||
            env.GOOGLE_CLOUD_REGION || // GCP general
            env.FUNCTION_REGION || // GCP Cloud Functions
            undefined,
        // Service name - check common platform variables (including GCP Cloud Run / App Engine)
        service:
            env.SERVICE_NAME ||
            env.APP_NAME ||
            env.K_SERVICE || // GCP Cloud Run
            env.GAE_SERVICE || // GCP App Engine
            env.FUNCTION_TARGET || // GCP Cloud Functions
            env.VERCEL_PROJECT_PRODUCTION_URL ||
            env.FLY_APP_NAME ||
            env.RAILWAY_SERVICE_NAME ||
            env.RENDER_SERVICE_NAME ||
            env.HEROKU_APP_NAME ||
            undefined,
        // Version (including GCP Cloud Run K_REVISION and App Engine GAE_VERSION)
        version:
            env.APP_VERSION ||
            env.npm_package_version ||
            env.K_REVISION || // GCP Cloud Run revision
            env.GAE_VERSION || // GCP App Engine version
            env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ||
            env.RENDER_GIT_COMMIT?.slice(0, 7) ||
            undefined,
        /* eslint-enable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing */
    };

    // Clean up undefined values
    return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined));
};

/**
 * Environment Enrichment Processor.
 *
 * Inspired by evlog's automatic environment detection, this processor
 * enriches log metadata with runtime environment information. It auto-detects
 * details like service name, version, environment, region, and commit hash
 * from common environment variables used by popular hosting platforms.
 *
 * The detected info is added to the log's context, making it easier to
 * correlate logs across services and deployments in production.
 * @template L - The log level type
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 * import EnvironmentProcessor from "@visulima/pail/processor/environment";
 *
 * const logger = createPail({
 *   processors: [
 *     new EnvironmentProcessor({
 *       overrides: { service: "my-api" },
 *       includePid: true,
 *     }),
 *   ],
 * });
 *
 * logger.info("Server started");
 * // Log metadata will include: { __env: { service: "my-api", environment: "production", ... } }
 * ```
 * @example
 * ```typescript
 * // With static configuration only (no auto-detection)
 * new EnvironmentProcessor({
 *   overrides: {
 *     service: "payment-service",
 *     version: "2.1.0",
 *     environment: "staging",
 *   },
 * });
 * ```
 */
class EnvironmentProcessor<L extends string = string> implements Processor<L> {
    readonly #envInfo: EnvironmentInfo;

    /**
     * Creates a new EnvironmentProcessor instance.
     *
     * Auto-detects environment information on construction and merges
     * with any provided overrides. Undefined values in overrides are
     * filtered out so they don't overwrite detected values.
     * @param options Processor configuration options
     */
    public constructor(options: EnvironmentProcessorOptions = {}) {
        const detected = detectEnvironment();

        // Filter out undefined values from overrides so they don't overwrite detected values
        const cleanOverrides: Partial<EnvironmentInfo> = {};

        if (options.overrides) {
            const overrideEntries: [string, unknown][] = Object.entries(options.overrides);

            for (let i = 0; i < overrideEntries.length; i += 1) {
                const [key, value] = overrideEntries[i];

                if (value !== undefined) {
                    (cleanOverrides as Record<string, unknown>)[key] = value;
                }
            }
        }

        const merged = { ...detected, ...cleanOverrides };

        // Remove pid/hostname if not requested, unless explicitly provided in overrides
        if (!options.includePid && cleanOverrides.pid === undefined) {
            delete merged.pid;
        }

        if (!options.includeHostname && cleanOverrides.hostname === undefined) {
            delete merged.hostname;
        }

        this.#envInfo = merged;
    }

    /**
     * Processes log metadata to add environment information.
     *
     * Adds a `__env` property to the meta containing detected and
     * configured environment details. Each call receives a shallow
     * clone of the environment info to prevent cross-record mutation.
     * @param meta The log metadata to process
     * @returns The processed metadata with environment info added
     */
    public process(meta: Meta<L>): Meta<L> {
        // Shallow clone to prevent mutations from leaking across log records
        const enriched: Meta<L> & { envStorage?: EnvironmentInfo } = { ...meta, envStorage: { ...this.#envInfo } };

        return enriched;
    }

    /**
     * Returns the detected environment information.
     *
     * Useful for inspecting what environment details were auto-detected.
     * Returns a shallow clone to prevent external mutation.
     * @returns The environment information object
     */
    public getEnvironmentInfo(): Readonly<EnvironmentInfo> {
        return { ...this.#envInfo };
    }
}

export { detectEnvironment };
export default EnvironmentProcessor;
export type { EnvironmentInfo, EnvironmentProcessorOptions };
