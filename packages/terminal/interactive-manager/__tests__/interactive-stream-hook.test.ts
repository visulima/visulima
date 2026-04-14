import { describe, expect, it } from "vitest";

import InteractiveStreamHook from "../src/interactive-stream-hook";

describe("interactiveStreamHook", () => {
    it("should be instantiable with a write stream", () => {
        expect.assertions(1);

        const hook = new InteractiveStreamHook(process.stdout);

        expect(hook).toBeDefined();
    });

    it("should have a static DRAIN constant", () => {
        expect.assertions(1);

        expect(InteractiveStreamHook.DRAIN).toBe(true);
    });
});
