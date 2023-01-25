import "cross-fetch/polyfill";

import { testApiHandler } from "next-test-api-route-handler";
import { describe, expect, it } from "vitest";

import { HealthCheck, healthCheckHandler, nodeEnvCheck as nodeEnvironmentCheck } from "../../src";

const HealthCheckService = new HealthCheck();

HealthCheckService.addChecker("node-env", nodeEnvironmentCheck());

describe("health check route", () => {
    it("endpoint returns health checks reports", async () => {
        expect.assertions(3);

        await testApiHandler({
            handler: healthCheckHandler(HealthCheckService),
            test: async ({ fetch }) => {
                const response = await fetch();

                expect(response["status"]).toBe(200);
                expect(response["headers"].get("content-type")).toBe("application/json");

                const jsonResponse = await response.json();

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
            },
        });
    });

    it("endpoint returns health checks reports with custom app name and version", async () => {
        expect.assertions(3);

        process.env["APP_NAME"] = "my-app";
        process.env["APP_VERSION"] = "1.0.0";

        await testApiHandler({
            handler: healthCheckHandler(HealthCheckService),
            test: async ({ fetch }) => {
                const response = await fetch();

                expect(response["status"]).toBe(200);
                expect(response["headers"].get("content-type")).toBe("application/json");

                const jsonResponse = await response.json();

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
            },
        });

        process.env["APP_NAME"] = undefined;
        process.env["APP_VERSION"] = undefined;
    });
});
