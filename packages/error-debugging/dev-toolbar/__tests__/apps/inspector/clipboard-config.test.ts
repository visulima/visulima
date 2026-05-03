import { afterEach, describe, expect, it } from "vitest";

import {
    BUILT_IN_PROFILES,
    DETAIL_DEFAULTS,
    isFieldEnabled,
    loadClipboardProfile,
    resetClipboardProfile,
    saveClipboardProfile,
} from "../../../src/apps/inspector/clipboard-config";

describe("clipboard-config", () => {
    afterEach(() => {
        resetClipboardProfile();
    });

    describe(isFieldEnabled, () => {
        it("returns the detail-level default when no override is set", () => {
            expect.assertions(4);

            const profile = { detail: "standard" as const, name: "Standard" };

            expect(isFieldEnabled(profile, "url")).toBe(true);
            expect(isFieldEnabled(profile, "componentStack")).toBe(true);
            expect(isFieldEnabled(profile, "computedStyles")).toBe(false);
            expect(isFieldEnabled(profile, "accessibility")).toBe(false);
        });

        it("respects per-field overrides over the detail-level default", () => {
            expect.assertions(3);

            const profile = {
                detail: "compact" as const,
                fields: { selector: true, url: false },
                name: "Custom",
            };

            // detail says only selectedText is on, but the override turns selector on too
            expect(isFieldEnabled(profile, "selector")).toBe(true);
            // url is normally off in compact and the override leaves it off
            expect(isFieldEnabled(profile, "url")).toBe(false);
            // selectedText is on by default in compact
            expect(isFieldEnabled(profile, "selectedText")).toBe(true);
        });

        it("treats explicit false as a hard off, even in forensic", () => {
            expect.assertions(2);

            const profile = {
                detail: "forensic" as const,
                fields: { computedStyles: false },
                name: "Custom",
            };

            // forensic normally includes computedStyles
            expect(DETAIL_DEFAULTS.forensic.has("computedStyles")).toBe(true);
            // but the override wins
            expect(isFieldEnabled(profile, "computedStyles")).toBe(false);
        });
    });

    describe("dETAIL_DEFAULTS", () => {
        it("compact only emits selectedText", () => {
            expect.assertions(1);
            expect([...DETAIL_DEFAULTS.compact]).toEqual(["selectedText"]);
        });

        it("standard does not include forensic-only fields", () => {
            expect.assertions(3);
            expect(DETAIL_DEFAULTS.standard.has("accessibility")).toBe(false);
            expect(DETAIL_DEFAULTS.standard.has("computedStyles")).toBe(false);
            expect(DETAIL_DEFAULTS.standard.has("nearbyElements")).toBe(false);
        });

        it("detailed adds context fields but no a11y/styles/nearbyElements", () => {
            expect.assertions(5);
            expect(DETAIL_DEFAULTS.detailed.has("classes")).toBe(true);
            expect(DETAIL_DEFAULTS.detailed.has("nearbyText")).toBe(true);
            expect(DETAIL_DEFAULTS.detailed.has("domPath")).toBe(true);
            expect(DETAIL_DEFAULTS.detailed.has("accessibility")).toBe(false);
            expect(DETAIL_DEFAULTS.detailed.has("computedStyles")).toBe(false);
        });

        it("forensic includes everything", () => {
            // One per field in the detailed-defaults loop, plus three explicit
            // forensic-only checks below.
            expect.assertions(DETAIL_DEFAULTS.detailed.size + 3);

            for (const field of DETAIL_DEFAULTS.detailed) {
                expect(DETAIL_DEFAULTS.forensic.has(field)).toBe(true);
            }

            expect(DETAIL_DEFAULTS.forensic.has("accessibility")).toBe(true);
            expect(DETAIL_DEFAULTS.forensic.has("computedStyles")).toBe(true);
            expect(DETAIL_DEFAULTS.forensic.has("nearbyElements")).toBe(true);
        });
    });

    describe("built-in profiles", () => {
        it("ide profile turns on selector + source + componentSource", () => {
            expect.assertions(3);

            const ide = BUILT_IN_PROFILES.ide!;

            expect(ide.fields?.selector).toBe(true);
            expect(ide.fields?.source).toBe(true);
            expect(ide.fields?.componentSource).toBe(true);
        });

        it("every profile has a non-empty name and id", () => {
            // Two assertions per built-in profile.
            expect.assertions(Object.keys(BUILT_IN_PROFILES).length * 2);

            for (const [id, profile] of Object.entries(BUILT_IN_PROFILES)) {
                expect(profile.name.length).toBeGreaterThan(0);
                expect(id.length).toBeGreaterThan(0);
            }
        });
    });

    describe(loadClipboardProfile, () => {
        it("returns the AI-agent default when storage is empty", () => {
            expect.assertions(2);

            const loaded = loadClipboardProfile();

            expect(loaded.name).toBe("For AI agent");
            expect(loaded.detail).toBe("detailed");
        });

        it("round-trips through saveClipboardProfile", () => {
            expect.assertions(2);

            saveClipboardProfile({ detail: "compact", fields: { url: true }, name: "Mine" });
            const loaded = loadClipboardProfile();

            expect(loaded.name).toBe("Mine");
            expect(loaded.fields?.url).toBe(true);
        });

        it("returns the default when stored data has an invalid detail level", () => {
            expect.assertions(1);

            globalThis.localStorage.setItem("__v_dt__clipboard_profile", JSON.stringify({ detail: "bogus", name: "x" }));
            const loaded = loadClipboardProfile();

            expect(loaded.name).toBe("For AI agent");
        });

        it("returns the default when stored data is malformed JSON", () => {
            expect.assertions(1);

            globalThis.localStorage.setItem("__v_dt__clipboard_profile", "{not json");
            const loaded = loadClipboardProfile();

            expect(loaded.name).toBe("For AI agent");
        });
    });
});
