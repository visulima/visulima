import type { IncomingMessage, ServerResponse } from "node:http";

import type { CheckerType, HealthCheck, HealthReport } from "../types";
import respond from "./respond";

// Inlined HTTP status codes to avoid pulling the `http-status-codes` runtime
// dependency into every consumer for three constants.
const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

interface HealthCheckApiPayload {
    appName: string;
    appVersion: string;
    message: string;
    reports: HealthReport;
    status: "error" | "ok";
    timestamp: string;
}

interface HealthCheckHandlerOptions {
    /**
     * Application name surfaced in the payload. Defaults to `process.env.APP_NAME`,
     * then `"unknown"`.
     */
    appName?: string;

    /**
     * Application version surfaced in the payload. Defaults to
     * `process.env.APP_VERSION`, then `"unknown"`.
     */
    appVersion?: string;

    /**
     * Whether to set the `Content-Type: application/json` response header.
     * Defaults to `true`.
     */
    sendHeader?: boolean;

    /**
     * When set, only checkers participating in this probe type are run/reported.
     * Use `"liveness"` to build a liveness endpoint with a full JSON payload.
     */
    type?: CheckerType;
}

/**
 * Creates a framework-agnostic Node HTTP handler that serves the full health
 * report as JSON. Responds with `200` when healthy and `503` otherwise.
 * @param healthCheck The {@link HealthCheck} registry to report on.
 * @param options Handler options. For backwards compatibility a boolean may
 * be passed instead, which is treated as `{ sendHeader }`.
 */
const healthCheckHandler = (healthCheck: HealthCheck, options: HealthCheckHandlerOptions | boolean = {}) => {
    const resolved: HealthCheckHandlerOptions = typeof options === "boolean" ? { sendHeader: options } : options;
    const { appName, appVersion, sendHeader = true, type } = resolved;

    return async <Request extends IncomingMessage, Response extends ServerResponse>(_: Request, response: Response): Promise<void> => {
        const resolvedAppName = appName ?? process.env.APP_NAME ?? "unknown";
        const resolvedAppVersion = appVersion ?? process.env.APP_VERSION ?? "unknown";
        const timestamp = new Date().toISOString();

        let payload: HealthCheckApiPayload;
        let statusCode: number;

        try {
            const { healthy, report } = await healthCheck.getReport(type);

            payload = {
                appName: resolvedAppName,
                appVersion: resolvedAppVersion,
                message: healthy ? "Health check successful" : "Health check failed",
                reports: report,
                status: healthy ? "ok" : "error",
                timestamp,
            };

            statusCode = healthy ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);

            payload = {
                appName: resolvedAppName,
                appVersion: resolvedAppVersion,
                message: "Health check failed",
                reports: {},
                status: "error",
                timestamp,
            };

            statusCode = HTTP_SERVICE_UNAVAILABLE;
        }

        respond(response, { body: JSON.stringify(payload, null, 2), sendHeader, statusCode });
    };
};

export type { HealthCheckApiPayload, HealthCheckHandlerOptions };

export default healthCheckHandler;
