import { describe, expect, it } from "vitest";

import type { DlxSeenEntry } from "../../src/dlx/first-run-state";
import { getSeenEntry, shouldReprompt } from "../../src/dlx/first-run-state";

const entry = (alertKeys: string[]): DlxSeenEntry => {
    return { alertKeys, seenAt: 1 };
};

describe(getSeenEntry, () => {
    it("looks up by name@version", () => {
        expect.assertions(2);

        const state = { packages: { "create-vite@5.2.0": entry([]) }, version: 1 as const };

        expect(getSeenEntry(state, "create-vite", "5.2.0")).toStrictEqual(entry([]));
        expect(getSeenEntry(state, "create-vite", "5.3.0")).toBeUndefined();
    });
});

describe(shouldReprompt, () => {
    it("re-prompts when the version was never approved", () => {
        expect.assertions(1);

        expect(shouldReprompt(undefined, [])).toBe(true);
    });

    it("does not re-prompt for an approved version with no new alerts", () => {
        expect.assertions(1);

        expect(shouldReprompt(entry(["alert-a"]), ["alert-a"])).toBe(false);
    });

    it("re-prompts when a new high/critical alert key appears", () => {
        expect.assertions(1);

        expect(shouldReprompt(entry(["alert-a"]), ["alert-a", "alert-b"])).toBe(true);
    });

    it("does not re-prompt when a previously-seen alert was resolved", () => {
        expect.assertions(1);

        expect(shouldReprompt(entry(["alert-a", "alert-b"]), ["alert-a"])).toBe(false);
    });
});
