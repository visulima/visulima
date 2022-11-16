import {
    Checker, HealthCheck as HealthcheckInterface, HealthReport, HealthReportEntry,
} from "./types";

class Healthcheck implements HealthcheckInterface {
    /**
     * A copy of registered checkers
     */
    private healthCheckers: { [service: string]: Checker } = {};

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
        const checker = this.healthCheckers[service] as Checker;

        let report: HealthReportEntry;

        try {
            report = await checker();

            report.displayName = report.displayName || service;
        } catch (error: any) {
            report = {
                displayName: service,
                health: { healthy: false, message: error.message, timestamp: new Date().toISOString() },
                meta: { fatal: true },
            };
        }

        // eslint-disable-next-line no-param-reassign
        reportSheet[service] = report;

        return report.health.healthy;
    }

    public addChecker(service: string, checker: Checker): void {
        this.healthCheckers[service] = checker;
    }

    /**
     * Returns the health check reports. The health checks are performed when
     * this method is invoked.
     */
    public async getReport(): Promise<{ healthy: boolean; report: HealthReport }> {
        const report: HealthReport = {};

        // eslint-disable-next-line compat/compat
        await Promise.all(Object.keys(this.healthCheckers).map((service) => this.invokeChecker(service, report)));

        /**
         * Finding unhealthy service to know if system is healthy or not
         */
        const unhealthyService = Object.keys(report).find((service) => !(report[service] as HealthReportEntry).health.healthy);

        return { healthy: !unhealthyService, report };
    }

    public async isLive(): Promise<boolean> {
        const { healthy } = await this.getReport();

        return healthy;
    }
}

export default Healthcheck;
