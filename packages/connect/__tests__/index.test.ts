import { describe, expect, it } from "vitest";

import { createRouter } from "../src";

describe(createRouter, () => {
    it("imports", async () => {
        expect.assertions(1);

        expect(createRouter).toBeDefined();
    });
});
