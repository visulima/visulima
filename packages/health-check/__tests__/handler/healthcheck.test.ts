import { describe, expect, it } from "vitest";
import { testApiHandler } from "next-test-api-route-handler";

import { healthCheckHandler, HealthCheck as HealthCheck, nodeEnvironmentCheck } from "../../src";

const HealthCheckService = new HealthCheck();

HealthCheckService.addChecker("node-env", nodeEnvironmentCheck);

describe("health check route", () => {
    it("endpoint returns health checks reports", async () => {
        expect.assertions(2);

        await testApiHandler({
            handler: healthCheckHandler(HealthCheckService),
            test: async ({ fetch }) => {
                const response = await fetch();

                expect(response.status).toBe(200);

                const jsonResponse = await response.json();

                expect(jsonResponse).toStrictEqual({
                    appName: "unknown",
                    appVersion: "unknown",
                    message: "Health check successful",
                    reports: {},
                    status: "ok",
                    timestamp: jsonResponse.timestamp,
                });
            },
        });
    });
    //
    // it("endpoint can handel checks and returns reports", async () => {
    //     expect.assertions(2);
    //
    //     await testApiHandler({
    //         handler: healthCheckHandler({
    //             "event-loop": async () => {
    //                 return {
    //                     displayName: "event loop",
    //                     health: {
    //                         healthy: true,
    //                         message: "event loop is healthy",
    //                         timestamp: "2021-07-01T00:00:00.000Z",
    //                     },
    //                 };
    //             },
    //         }),
    //         test: async ({ fetch }) => {
    //             const response = await fetch();
    //
    //             expect(response.status).toBe(200);
    //
    //             const jsonResponse = await response.json();
    //
    //             expect(jsonResponse).toStrictEqual({
    //                 appName: "unknown",
    //                 appVersion: "unknown",
    //                 message: "Health check successful",
    //                 reports: {
    //                     "event-loop": {
    //                         displayName: "event loop",
    //                         health: {
    //                             healthy: true,
    //                             message: "event loop is healthy",
    //                             timestamp: "2021-07-01T00:00:00.000Z",
    //                         },
    //                     },
    //                 },
    //                 status: "ok",
    //                 timestamp: jsonResponse.timestamp,
    //             });
    //         },
    //     });
    // });
});
