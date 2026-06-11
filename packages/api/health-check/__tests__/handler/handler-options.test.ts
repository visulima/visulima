import { createRequest, createResponse } from "node-mocks-http";
import { afterEach, describe, expect, it } from "vitest";

import { HealthCheck, healthCheckHandler, healthLiveHandler } from "../../src";

const dateString = new Date().toISOString();

const healthyChecker = async () => {
    return {
        displayName: "ok",
        health: {
            healthy: true,
            timestamp: dateString,
        },
    };
};

describe("healthCheckHandler options", () => {
    afterEach(() => {
        delete process.env.APP_NAME;
        delete process.env.APP_VERSION;
    });

    it("uses appName/appVersion from options over env", async () => {
        expect.assertions(2);

        process.env.APP_NAME = "from-env";

        const service = new HealthCheck();

        service.addChecker("db", healthyChecker);

        const callback = healthCheckHandler(service, { appName: "from-options", appVersion: "9.9.9" });

        const responseMock = createResponse();

        await callback(createRequest(), responseMock);

        // eslint-disable-next-line no-underscore-dangle
        const jsonResponse = responseMock._getJSONData() as Record<string, unknown>;

        expect(jsonResponse.appName).toBe("from-options");
        expect(jsonResponse.appVersion).toBe("9.9.9");
    });

    it("still accepts a boolean as the second argument (sendHeader)", async () => {
        expect.assertions(2);

        const service = new HealthCheck();

        service.addChecker("db", healthyChecker);

        const callback = healthCheckHandler(service, false);

        const responseMock = createResponse();

        await callback(createRequest(), responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(200);
        expect(responseMock.getHeader("content-type")).toBeUndefined();
    });

    it("filters by probe type", async () => {
        expect.assertions(1);

        const service = new HealthCheck();

        service.addChecker("live", healthyChecker, { type: "liveness" });
        service.addChecker(
            "ready",
            async () => { return { displayName: "ready", health: { healthy: false, message: "down", timestamp: dateString } }; },
            { type: "readiness" },
        );

        const callback = healthCheckHandler(service, { type: "liveness" });

        const responseMock = createResponse();

        await callback(createRequest(), responseMock);

        // eslint-disable-next-line no-underscore-dangle
        expect(responseMock._getStatusCode()).toBe(200);
    });
});

describe(healthLiveHandler, () => {
    it("returns 204 when live and 503 otherwise", async () => {
        expect.assertions(2);

        const liveService = new HealthCheck();

        liveService.addChecker("live", healthyChecker, { type: "liveness" });

        const liveResponse = createResponse();

        await healthLiveHandler(liveService)(createRequest(), liveResponse);

        // eslint-disable-next-line no-underscore-dangle
        expect(liveResponse._getStatusCode()).toBe(204);

        const downService = new HealthCheck();

        downService.addChecker(
            "live",
            async () => { return { displayName: "live", health: { healthy: false, message: "dead", timestamp: dateString } }; },
            { type: "liveness" },
        );

        const downResponse = createResponse();

        await healthLiveHandler(downService)(createRequest(), downResponse);

        // eslint-disable-next-line no-underscore-dangle
        expect(downResponse._getStatusCode()).toBe(503);
    });
});
