import "cross-fetch/polyfill";

import { testApiHandler } from "next-test-api-route-handler";
import { describe, expect, it } from "vitest";

import { HealthCheck, healthReadyHandler, nodeEnvCheck as nodeEnvironmentCheck } from "../../src";

const HealthCheckService = new HealthCheck();

HealthCheckService.addChecker("node-env", nodeEnvironmentCheck());

describe("health ready route", () => {
    it("endpoint returns health checks reports", async () => {
        expect.assertions(2);

        await testApiHandler({
            handler: healthReadyHandler(HealthCheckService),
            test: async ({ fetch }) => {
                const response = await fetch();

                expect(response.status).toBe(204);
                expect(response.headers.get("content-type")).toBeNull();
            },
        });
    });
});
