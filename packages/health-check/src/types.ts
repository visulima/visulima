/**
 * Shape of health report entry. Each checker must
 * return an object with similar shape.
 */
export interface HealthReportEntry {
    displayName: string;
    health: {
        healthy: boolean;
        message?: string;
        timestamp: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meta?: any;
}

export type Checker = () => Promise<HealthReportEntry>;

/**
 * The shape of entire report
 */
export type HealthReport = Record<string, HealthReportEntry>;

/**
 * Shape of health check contract
 */
export interface HealthCheck {
    addChecker: (service: string, checker: Checker) => void;
    getReport: () => Promise<{ healthy: boolean; report: HealthReport }>;
    isLive: () => Promise<boolean>;
    servicesList: string[];
}
