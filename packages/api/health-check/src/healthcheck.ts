import type { AddCheckerOptions, Checker, CheckerType, HealthCheck as HealthcheckInterface, HealthReport, HealthReportEntry } from "./types";

/**
 * A graceful-shutdown hook. Invoked once when {@link Healthcheck.shutdown} is
 * called (e.g. from a `SIGTERM`/`SIGINT` handler) so the service can drain
 * connections, close pools, etc. before the process exits.
 */
type ShutdownHook = () => Promise<void> | void;

interface RegisteredChecker {
    checker: Checker;
    timeout?: number;
    types: Set<CheckerType>;
}

interface HealthcheckOptions {
    /**
     * When set, the last computed report is cached for this many milliseconds.
     * Subsequent probes within the window return the cached report instead of
     * re-running every checker. This protects upstream dependencies from being
     * hammered by orchestrators that probe every few seconds. Defaults to `0`
     * (no caching).
     */
    cacheTtl?: number;

    /**
     * Default per-check timeout, in milliseconds, applied to every checker that
     * does not specify its own. Defaults to `undefined` (no timeout).
     */
    defaultTimeout?: number;
}

const ALL_TYPES: ReadonlyArray<CheckerType> = ["liveness", "readiness"];

/**
 * Runs a checker, racing it against its configured timeout (if any).
 */
const runWithTimeout = async (service: string, registered: RegisteredChecker): Promise<HealthReportEntry> => {
    const { checker, timeout } = registered;

    if (timeout === undefined || timeout <= 0) {
        return checker();
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`Health check "${service}" timed out after ${timeout}ms`));
        }, timeout);
    });

    try {
        return await Promise.race([checker(), timeoutPromise]);
    } finally {
        if (timer !== undefined) {
            clearTimeout(timer);
        }
    }
};

class Healthcheck implements HealthcheckInterface {
    /**
     * A copy of registered checkers
     */
    private readonly healthCheckers: Record<string, RegisteredChecker> = {};

    private readonly cacheTtl: number;

    private readonly defaultTimeout: number | undefined;

    private readonly shutdownHooks: ShutdownHook[] = [];

    private cache = new Map<CheckerType | "__all__", { expiresAt: number; value: { healthy: boolean; report: HealthReport } }>();

    public constructor(options: HealthcheckOptions = {}) {
        this.cacheTtl = options.cacheTtl ?? 0;
        this.defaultTimeout = options.defaultTimeout;
    }

    public addChecker(service: string, checker: Checker, options: AddCheckerOptions = {}): void {
        const type = options.type ?? ALL_TYPES;
        const types = new Set<CheckerType>(Array.isArray(type) ? type : [type]);

        this.healthCheckers[service] = {
            checker,
            timeout: options.timeout ?? this.defaultTimeout,
            types,
        };

        // Mutating the registry invalidates any cached report.
        this.cache.clear();
    }

    /**
     * Removes a previously registered checker.
     * @returns `true` if a checker existed and was removed, `false` otherwise.
     */
    public removeChecker(service: string): boolean {
        if (!(service in this.healthCheckers)) {
            return false;
        }

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.healthCheckers[service];

        this.cache.clear();

        return true;
    }

    /**
     * Registers a hook to run on graceful shutdown. Hooks run in registration
     * order when {@link Healthcheck.shutdown} is invoked.
     */
    public onShutdown(hook: ShutdownHook): void {
        this.shutdownHooks.push(hook);
    }

    /**
     * Runs all registered shutdown hooks in order. Safe to call once; intended
     * to be wired to process termination signals.
     */
    public async shutdown(): Promise<void> {
        for (const hook of this.shutdownHooks) {
            // eslint-disable-next-line no-await-in-loop
            await hook();
        }
    }

    /**
     * Returns the health check reports. The health checks are performed when
     * this method is invoked (unless a fresh cached report is available).
     * @param type When provided, only checkers participating in that probe
     * type are run/reported.
     */
    public async getReport(type?: CheckerType): Promise<{ healthy: boolean; report: HealthReport }> {
        const cacheKey: CheckerType | "__all__" = type ?? "__all__";

        if (this.cacheTtl > 0) {
            const cached = this.cache.get(cacheKey);

            if (cached !== undefined && cached.expiresAt > Date.now()) {
                return cached.value;
            }
        }

        const report: HealthReport = {};

        const services = Object.keys(this.healthCheckers).filter(
            (service) => type === undefined || (this.healthCheckers[service] as RegisteredChecker).types.has(type),
        );

        await Promise.all(services.map(async (service) => await this.invokeChecker(service, report)));

        /**
         * Finding unhealthy service to know if system is healthy or not
         */
        const unhealthyService = Object.keys(report).find((service) => !(report[service] as HealthReportEntry).health.healthy);

        const value = { healthy: !unhealthyService, report };

        if (this.cacheTtl > 0) {
            this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtl, value });
        }

        return value;
    }

    /**
     * Returns whether the service is live. Only checkers tagged `liveness`
     * (the default for every checker) participate.
     */
    public async isLive(): Promise<boolean> {
        const { healthy } = await this.getReport("liveness");

        return healthy;
    }

    /**
     * Returns whether the service is ready to accept traffic. Only checkers
     * tagged `readiness` (the default for every checker) participate.
     */
    public async isReady(): Promise<boolean> {
        const { healthy } = await this.getReport("readiness");

        return healthy;
    }

    /**
     * Returns an array of registered services names
     */
    public get servicesList(): string[] {
        return Object.keys(this.healthCheckers);
    }

    /**
     * Invokes a given checker to collect the report metrics.
     */
    private async invokeChecker(service: string, reportSheet: HealthReport): Promise<boolean> {
        const registered = this.healthCheckers[service] as RegisteredChecker;

        let report: HealthReportEntry;

        try {
            report = await runWithTimeout(service, registered);

            report.displayName = report.displayName || service;
        } catch (error) {
            report = {
                displayName: service,
                health: { healthy: false, message: (error as Error).message, timestamp: new Date().toISOString() },
                meta: { fatal: true },
            };
        }

        reportSheet[service] = report;

        return report.health.healthy;
    }
}

export type { ShutdownHook };

export default Healthcheck;
