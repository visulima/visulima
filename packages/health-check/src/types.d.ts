export type Checker = () => Promise<HealthReportEntry>;

/**
 * Shape of health report entry. Each checker must
 * return an object with similar shape.
 */
export type HealthReportEntry = {
    displayName: string;
    health: {
        healthy: boolean;
        message?: string;
        timestamp: string;
    };
    meta?: any;
};

/**
 * The shape of entire report
 */
export type HealthReport = {
    [service: string]: HealthReportEntry;
};

/**
 * Shape of health check contract
 */
export interface HealthCheck {
    servicesList: string[];
    addChecker(service: string, checker: Checker): void;
    isLive(): Promise<boolean>;
    getReport(): Promise<{ healthy: boolean; report: HealthReport }>;
}
