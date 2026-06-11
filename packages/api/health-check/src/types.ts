/**
 * Shape of health report entry. Each checker must
 * return an object with similar shape.
 * @template TMeta - Shape of the optional, checker-specific `meta` payload.
 */
export interface HealthReportEntry<TMeta = unknown> {
    displayName: string;
    health: {
        healthy: boolean;
        message?: string;
        timestamp: string;
    };
    meta?: TMeta;
}

/**
 * A health checker. Resolves with a {@link HealthReportEntry} describing the
 * current health of a single dependency or aspect of the service.
 * @template TMeta - Shape of the optional, checker-specific `meta` payload.
 */
export type Checker<TMeta = unknown> = () => Promise<HealthReportEntry<TMeta>>;

/**
 * The kind of probe a checker participates in.
 *
 * `readiness` checkers run on the readiness probe (`/health/ready`) and the generic report; they answer "can this service accept traffic right now?".
 *
 * `liveness` checkers run on the liveness probe (`isLive()`); they answer "is the process alive / not deadlocked?" and should be cheap.
 *
 * A checker may belong to both (the default).
 */
export type CheckerType = "liveness" | "readiness";

/**
 * Options accepted when registering a checker via {@link HealthCheck.addChecker}.
 */
export interface AddCheckerOptions {
    /**
     * Maximum time, in milliseconds, a checker is allowed to run before it is
     * reported as unhealthy with a timeout message. When omitted no per-check
     * timeout is applied (a global default can be configured on the registry).
     */
    timeout?: number;

    /**
     * Which probe(s) this checker participates in. Defaults to both liveness
     * and readiness.
     */
    type?: CheckerType | CheckerType[];
}

/**
 * The shape of entire report.
 * @template TMeta - Shape of the optional, checker-specific `meta` payload.
 */
export type HealthReport<TMeta = unknown> = Record<string, HealthReportEntry<TMeta>>;

/**
 * Shape of health check contract.
 */
export interface HealthCheck {
    addChecker: (service: string, checker: Checker, options?: AddCheckerOptions) => void;
    getReport: (type?: CheckerType) => Promise<{ healthy: boolean; report: HealthReport }>;
    isLive: () => Promise<boolean>;
    removeChecker: (service: string) => boolean;
    servicesList: string[];
}
