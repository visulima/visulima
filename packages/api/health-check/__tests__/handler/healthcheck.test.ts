import "cross-fetch/polyfill";

import { createRequest, createResponse } from "node-mocks-http";
import { beforeAll, describe, expect, it } from "vitest";

import { HealthCheck, healthCheckHandler, nodeEnvCheck as nodeEnvironmentCheck } from "../../src";

const HealthCheckService = new HealthCheck();

describe("health check route", () => {
    beforeAll(() => {
        HealthCheckService.addChecker("node-env", nodeEnvironmentCheck());
    });

    it("endpoint returns health checks reports", async () => {
        expect.assertions(3);

        const callback = healthCheckHandler(HealthCheckService);

        const requestMock = createRequest();
        const responseMock = createResponse();

        await callback(requestMock, responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(200);
        expect(responseMock.getHeader("content-type")).toBe("application/json");

        // eslint-disable-next-line no-underscore-dangle
        const jsonResponse = responseMock._getJSONData() as Record<string, unknown>;

        expect(jsonResponse).toStrictEqual({
            appName: "unknown",
            appVersion: "unknown",
            message: "Health check successful",
            reports: {
                "node-env": {
                    displayName: "Node Environment Check",
                    health: {
                        healthy: true,

                        timestamp: expect.any(String),
                    },
                    meta: {
                        env: "test",
                    },
                },
            },
            status: "ok",
            timestamp: jsonResponse.timestamp,
        });
    });

    it("endpoint returns health checks reports with custom app name and version", async () => {
        expect.assertions(3);

        process.env.APP_NAME = "my-app";
        process.env.APP_VERSION = "1.0.0";

        const callback = healthCheckHandler(HealthCheckService);

        const requestMock = createRequest();
        const responseMock = createResponse();

        await callback(requestMock, responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(200);
        expect(responseMock.getHeader("content-type")).toBe("application/json");

        // eslint-disable-next-line no-underscore-dangle
        const jsonResponse = responseMock._getJSONData() as Record<string, unknown>;

        expect(jsonResponse).toStrictEqual({
            appName: "my-app",
            appVersion: "1.0.0",
            message: "Health check successful",
            reports: {
                "node-env": {
                    displayName: "Node Environment Check",
                    health: {
                        healthy: true,

                        timestamp: expect.any(String),
                    },
                    meta: {
                        env: "test",
                    },
                },
            },
            status: "ok",
            timestamp: jsonResponse.timestamp,
        });

        process.env.APP_NAME = undefined;
        process.env.APP_VERSION = undefined;
    });

    it("endpoint returns a 503 error payload when a checker is unhealthy", async () => {
        expect.assertions(4);

        const unhealthyService = new HealthCheck();

        unhealthyService.addChecker("database", async () => {
            throw new Error("connection refused");
        });

        const callback = healthCheckHandler(unhealthyService);

        const requestMock = createRequest();
        const responseMock = createResponse();

        await callback(requestMock, responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(503);

        // eslint-disable-next-line no-underscore-dangle
        const jsonResponse = responseMock._getJSONData() as Record<string, unknown>;

        expect(jsonResponse.message).toBe("Health check failed");
        expect(jsonResponse.status).toBe("error");
        expect(jsonResponse.reports).toStrictEqual({
            database: {
                displayName: "database",
                health: {
                    healthy: false,
                    message: "connection refused",
                    timestamp: expect.any(String),
                },
                meta: {
                    fatal: true,
                },
            },
        });
    });

    it("endpoint ends the response with 503 when getReport unexpectedly rejects", async () => {
        expect.assertions(3);

        const brokenService = {
            addChecker: () => {},
            getReport: async () => {
                throw new Error("unexpected failure");
            },
            isLive: async () => true,
            isReady: async () => true,
            onShutdown: () => {},
            removeChecker: () => false,
            servicesList: [],
            shutdown: async () => {},
        };

        const callback = healthCheckHandler(brokenService);

        const requestMock = createRequest();
        const responseMock = createResponse();

        await callback(requestMock, responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(503);

        // eslint-disable-next-line no-underscore-dangle
        const jsonResponse = responseMock._getJSONData() as Record<string, unknown>;

        expect(jsonResponse.status).toBe("error");
        expect(jsonResponse.message).toBe("unexpected failure");
    });

    it("endpoint does not set the content-type header when sendHeader is false", async () => {
        expect.assertions(2);

        const callback = healthCheckHandler(HealthCheckService, false);

        const requestMock = createRequest();
        const responseMock = createResponse();

        await callback(requestMock, responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(200);
        expect(responseMock.getHeader("content-type")).toBeUndefined();
    });
});
