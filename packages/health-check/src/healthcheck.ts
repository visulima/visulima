import type { Checker, HealthCheck as HealthcheckInterface, HealthReport, HealthReportEntry } from "./types";

class Healthcheck implements HealthcheckInterface {
    /**
     * A copy of registered checkers
     */
    private healthCheckers: Record<string, Checker> = {};

    public addChecker(service: string, checker: Checker): void {
        // eslint-disable-next-line security/detect-object-injection
        this.healthCheckers[service] = checker;
    }

    /**
     * Returns the health check reports. The health checks are performed when
     * this method is invoked.
     */
    public async getReport(): Promise<{ healthy: boolean; report: HealthReport }> {
        const report: HealthReport = {};

        // eslint-disable-next-line compat/compat
        await Promise.all(Object.keys(this.healthCheckers).map(async (service) => await this.invokeChecker(service, report)));

        /**
         * Finding unhealthy service to know if system is healthy or not
         */
        // eslint-disable-next-line security/detect-object-injection
        const unhealthyService = Object.keys(report).find((service) => !(report[service] as HealthReportEntry).health.healthy);

        return { healthy: !unhealthyService, report };
    }

    public async isLive(): Promise<boolean> {
        const { healthy } = await this.getReport();

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
        // eslint-disable-next-line security/detect-object-injection
        const checker = this.healthCheckers[service] as Checker;

        let report: HealthReportEntry;

        try {
            report = await checker();

            report.displayName = report.displayName || service;
        } catch (error) {
            report = {
                displayName: service,
                health: { healthy: false, message: (error as Error).message, timestamp: new Date().toISOString() },
                meta: { fatal: true },
            };
        }

        // eslint-disable-next-line no-param-reassign,security/detect-object-injection
        reportSheet[service] = report;

        return report.health.healthy;
    }
}

export default Healthcheck;
