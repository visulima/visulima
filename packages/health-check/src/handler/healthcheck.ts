import { StatusCodes } from "http-status-codes";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { HealthCheck, HealthReport } from "../types";

export default (healthCheck: HealthCheck, sendHeader: boolean | undefined = true) =>
    async <Request extends IncomingMessage, Response extends ServerResponse>(_: Request, response: Response) => {
        const { healthy, report } = await healthCheck.getReport();

        const payload: HealthCheckApiPayload = {
            status: healthy ? "ok" : "error",
            message: healthy ? "Health check successful" : "Health check failed",
            appName: process.env.APP_NAME ?? "unknown",
            appVersion: process.env.APP_VERSION ?? "unknown",
            timestamp: new Date().toISOString(),
            reports: report,
        };

        response.statusCode = healthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

        if (sendHeader) {
            response.setHeader("Content-Type", "application/json");
        }

        response.end(JSON.stringify(payload));
    };

export type HealthCheckApiPayload = {
    status: "ok" | "error";
    message: string;
    appName: string;
    appVersion: string;
    timestamp: string;
    reports: HealthReport;
};
