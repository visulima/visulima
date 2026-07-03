import { describe, expect, it } from "vitest";

import type { DefaultLogTypes, LiteralUnion, LoggerTypesConfig } from "../../../src/types";
import getLongestBadge from "../../../src/utils/get-longest-badge";

describe(getLongestBadge, () => {
    it("should return the longest badge when given a non-empty list of badges", () => {
        expect.assertions(1);

        const types = {
            alert: { badge: "ALERT" },
            complete: { badge: "COMPLETE" },
            debug: { badge: "DEBUG" },
        };
        const result = getLongestBadge(types as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, string>, string>);

        expect(result).toBe("COMPLETE");
    });

    it("should return an empty string when given an empty list of badges", () => {
        expect.assertions(1);

        const types = {};
        const result = getLongestBadge(types as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, string>, string>);

        expect(result).toBe("");
    });

    it("should return the single badge when given a LoggerTypesConfig object with a single badge", () => {
        expect.assertions(1);

        const types = {
            alert: { badge: "ALERT" },
        };
        const result = getLongestBadge(types as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, string>, string>);

        expect(result).toBe("ALERT");
    });

    it("should return an empty string when given a LoggerTypesConfig object with no badges", () => {
        expect.assertions(1);

        const types = {
            alert: {},
            complete: {},
            debug: {},
        };
        const result = getLongestBadge(types as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, string>, string>);

        expect(result).toBe("");
    });

    it("should return the first badge when given multiple badges of the same length", () => {
        expect.assertions(1);

        const types = {
            alert: { badge: "ALERT" },
            complete: { badge: "DONE" },
            debug: { badge: "INFO" },
        };

        const result = getLongestBadge(types as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, string>, string>);

        expect(result).toBe("ALERT");
    });
});
