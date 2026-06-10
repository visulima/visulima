// @vitest-environment node
import { describe, expect, it } from "vitest";

import HOOK_EVENT_NAMES_DEFAULT, { HOOK_EVENT_NAMES } from "../../src/hooks/events";

describe("hook event names", () => {
    it("is an array", () => {
        expect.hasAssertions();

        expect(Array.isArray(HOOK_EVENT_NAMES)).toBe(true);
    });

    it("contains all five expected event names", () => {
        expect.hasAssertions();

        expect(HOOK_EVENT_NAMES).toContain("devtools:init");
        expect(HOOK_EVENT_NAMES).toContain("devtools:open");
        expect(HOOK_EVENT_NAMES).toContain("devtools:close");
        expect(HOOK_EVENT_NAMES).toContain("app:error");
        expect(HOOK_EVENT_NAMES).toContain("timeline:event");
    });

    it("has exactly five entries (no duplicates, no extras)", () => {
        expect.hasAssertions();

        expect(HOOK_EVENT_NAMES).toHaveLength(5);
    });

    it("contains unique entries only", () => {
        expect.hasAssertions();

        const unique = new Set(HOOK_EVENT_NAMES);

        expect(unique.size).toBe(HOOK_EVENT_NAMES.length);
    });

    it("also exports as default export with the same reference", () => {
        expect.hasAssertions();

        // The default export must be the same array reference as the named export
        expect(HOOK_EVENT_NAMES_DEFAULT).toBe(HOOK_EVENT_NAMES);
    });

    it("event names match the HookEvents interface key format (colon-delimited namespace:action)", () => {
        expect.hasAssertions();

        for (const name of HOOK_EVENT_NAMES) {
            expect(name).toMatch(/^[\w-]+:[\w-]+$/);
        }
    });
});
