import "cross-fetch/polyfill";

import { createRequest, createResponse } from "node-mocks-http";
import { beforeAll, describe, expect, it } from "vitest";

import { HealthCheck, healthReadyHandler, nodeEnvCheck as nodeEnvironmentCheck } from "../../src";

const HealthCheckService = new HealthCheck();

describe("health ready route", () => {
    beforeAll(() => {
        HealthCheckService.addChecker("node-env", nodeEnvironmentCheck());
    });

    it("endpoint returns health checks reports", async () => {
        expect.assertions(2);

        const callback = healthReadyHandler(HealthCheckService);

        const requestMock = createRequest();
        const responseMock = createResponse();

        await callback(requestMock, responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(204);
        expect(responseMock.getHeader("content-type")).toBeUndefined();
    });

    it("endpoint returns a 503 status code when a checker is unhealthy", async () => {
        expect.assertions(1);

        const unhealthyService = new HealthCheck();

        unhealthyService.addChecker("database", async () => {
            throw new Error("connection refused");
        });

        const callback = healthReadyHandler(unhealthyService);

        const requestMock = createRequest();
        const responseMock = createResponse();

        await callback(requestMock, responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(503);
    });
});
