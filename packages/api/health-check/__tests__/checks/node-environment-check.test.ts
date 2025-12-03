import { describe, expect, it } from "vitest";

import nodeEnvironmentCheck from "../../src/checks/node-environment-check";

describe("node-environment-check", () => {
    it("should return healthy when the node env is set", async () => {
        expect.assertions(1);

        const result = await nodeEnvironmentCheck()();

        expect(result).toStrictEqual({
            displayName: "Node Environment Check",
            health: {
                healthy: true,

                timestamp: expect.any(String),
            },
            meta: {
                env: process.env.NODE_ENV,
            },
        });
    });

    it("should return healthy when the node env is set to production", async () => {
        expect.assertions(1);

        const oldEnvironment = process.env.NODE_ENV;

        process.env.NODE_ENV = "production";

        const result = await nodeEnvironmentCheck("production")();

        expect(result).toStrictEqual({
            displayName: "Node Environment Check",
            health: {
                healthy: true,

                timestamp: expect.any(String),
            },
            meta: {
                env: process.env.NODE_ENV,
            },
        });

        process.env.NODE_ENV = oldEnvironment;
    });

    it("should return unhealthy when the node env is set to production", async () => {
        expect.assertions(1);

        const result = await nodeEnvironmentCheck("production")();

        expect(result).toStrictEqual({
            displayName: "Node Environment Check",
            health: {
                healthy: false,
                message: "NODE_ENV environment variable is set to \"test\" instead of \"production\".",

                timestamp: expect.any(String),
            },
        });
    });

    it("should return unhealthy when the node env is not set", async () => {
        expect.assertions(1);

        const oldEnvironment = process.env.NODE_ENV;

        delete process.env.NODE_ENV;

        const result = await nodeEnvironmentCheck()();

        expect(result).toStrictEqual({
            displayName: "Node Environment Check",
            health: {
                healthy: false,
                message: "Missing NODE_ENV environment variable. It can make some parts of the application misbehave",

                timestamp: expect.any(String),
            },
        });

        process.env.NODE_ENV = oldEnvironment;
    });
});
