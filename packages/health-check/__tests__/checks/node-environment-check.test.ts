import { describe, expect, it } from "vitest";

import { nodeEnvironmentCheck } from "../../src";

describe("node-environment-check", () => {
    it("should return healthy when the node env is set", async () => {
        const result = await nodeEnvironmentCheck();

        expect(result).toStrictEqual({
            displayName: "Node Environment Check",
            health: {
                healthy: true,
                timestamp: expect.any(String),
            },
            meta: {
                env: process.env.NODE_ENV
            },
        });
    });
});
