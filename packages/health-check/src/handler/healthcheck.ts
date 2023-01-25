import { StatusCodes } from "http-status-codes";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { HealthCheck, HealthReport } from "../types";

// eslint-disable-next-line max-len
export default (healthCheck: HealthCheck, sendHeader: boolean | undefined = true) => async <Request extends IncomingMessage, Response extends ServerResponse>(_: Request, response: Response): Promise<void> => {
    const { healthy, report } = await healthCheck.getReport();

    const payload: HealthCheckApiPayload = {
        status: healthy ? "ok" : "error",
        message: healthy ? "Health check successful" : "Health check failed",
        appName: process.env["APP_NAME"] ?? "unknown",
        appVersion: process.env["APP_VERSION"] ?? "unknown",
        timestamp: new Date().toISOString(),
        reports: report,
    };

    response.statusCode = healthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

    if (sendHeader) {
        response.setHeader("Content-Type", "application/json");
    }

    response.end(JSON.stringify(payload, null, 2));
};

export type HealthCheckApiPayload = {
    status: "error" | "ok";
    message: string;
    appName: string;
    appVersion: string;
    timestamp: string;
    reports: HealthReport;
};
