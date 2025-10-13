import type { IncomingMessage, ServerResponse } from "node:http";

import { StatusCodes } from "http-status-codes";

import type { HealthCheck, HealthReport } from "../types";

export interface HealthCheckApiPayload {
    appName: string;
    appVersion: string;
    message: string;
    reports: HealthReport;
    status: "error" | "ok";
    timestamp: string;
}

export default (healthCheck: HealthCheck, sendHeader: boolean | undefined = true) =>
    async <Request extends IncomingMessage, Response extends ServerResponse>(_: Request, response: Response): Promise<void> => {
        const { healthy, report } = await healthCheck.getReport();

        const payload: HealthCheckApiPayload = {
            appName: process.env.APP_NAME ?? "unknown",
            appVersion: process.env.APP_VERSION ?? "unknown",
            message: healthy ? "Health check successful" : "Health check failed",
            reports: report,
            status: healthy ? "ok" : "error",
            timestamp: new Date().toISOString(),
        };

        response.statusCode = healthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

        if (sendHeader) {
            response.setHeader("Content-Type", "application/json");
        }

        response.end(JSON.stringify(payload, null, 2));
    };
