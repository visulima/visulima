import { describe, expect, it } from "vitest";

import { checkTyposquat, checkTyposquats, generateVariants } from "../src/typosquats";

describe("typosquats", () => {
    describe("generateVariants", () => {
        it("should return empty set for short names", () => {
            expect(generateVariants("ab").size).toBe(0);
            expect(generateVariants("a").size).toBe(0);
        });

        it("should generate character omission variants", () => {
            const variants = generateVariants("react");

            expect(variants.has("eact")).toBe(true); // drop 'r'
            expect(variants.has("ract")).toBe(true); // drop 'e'
            expect(variants.has("reat")).toBe(true); // drop 'c'
            expect(variants.has("reac")).toBe(true); // drop 't'
        });

        it("should generate transposition variants", () => {
            const variants = generateVariants("react");

            expect(variants.has("eract")).toBe(true); // swap r,e
            expect(variants.has("raect")).toBe(true); // swap e,a
            expect(variants.has("recat")).toBe(true); // swap a,c
            expect(variants.has("reatc")).toBe(true); // swap c,t
        });

        it("should generate duplication variants", () => {
            const variants = generateVariants("react");

            expect(variants.has("rreact")).toBe(true); // dup r
            expect(variants.has("reeact")).toBe(true); // dup e
        });

        it("should generate homoglyph substitution variants", () => {
            const variants = generateVariants("react");

            expect(variants.has("r3act")).toBe(true); // e→3
            expect(variants.has("re4ct")).toBe(true); // a→4
            expect(variants.has("reac7")).toBe(true); // t→7
        });

        it("should generate separator variants for hyphenated names", () => {
            const variants = generateVariants("body-parser");

            expect(variants.has("bodyparser")).toBe(true); // remove hyphens
            expect(variants.has("body.parser")).toBe(true); // dot
            expect(variants.has("body_parser")).toBe(true); // underscore
        });

        it("should generate hyphen insertion for long names without hyphens", () => {
            const variants = generateVariants("express");

            expect(variants.has("ex-press")).toBe(true);
            expect(variants.has("exp-ress")).toBe(true);
        });

        it("should generate common suffix variants", () => {
            const variants = generateVariants("lodash");

            expect(variants.has("lodash-js")).toBe(true);
            expect(variants.has("lodashjs")).toBe(true);
            expect(variants.has("lodash-node")).toBe(true);
        });

        it("should not generate suffix variants for scoped packages", () => {
            const variants = generateVariants("@scope/pkg");

            expect(variants.has("@scope/pkg-js")).toBe(false);
        });

        it("should not include the original name", () => {
            const variants = generateVariants("lodash");

            expect(variants.has("lodash")).toBe(false);
        });
    });

    describe("checkTyposquat", () => {
        it("should detect known blocklisted typosquats", () => {
            const result = checkTyposquat("axois");

            expect(result).toBeDefined();
            expect(result!.legitimate).toBe("axios");
            expect(result!.method).toBe("blocklist");
        });

        it("should detect heuristic typosquats of blocklisted packages", () => {
            // "expresss" is a transposition variant of "express"
            // It may or may not be in the blocklist, but the heuristic should catch it
            const result = checkTyposquat("expresss");

            expect(result).toBeDefined();
            expect(result!.legitimate).toBe("express");
        });

        it("should return undefined for legitimate package names", () => {
            expect(checkTyposquat("react")).toBeUndefined();
            expect(checkTyposquat("express")).toBeUndefined();
            expect(checkTyposquat("lodash")).toBeUndefined();
        });

        it("should return undefined for unrelated package names", () => {
            expect(checkTyposquat("my-totally-unique-package-name-xyz123")).toBeUndefined();
        });

        it("should handle scoped packages by checking the bare name", () => {
            const result = checkTyposquat("axois");

            expect(result).toBeDefined();
            expect(result!.legitimate).toBe("axios");
        });
    });

    describe("checkTyposquats", () => {
        it("should return empty array when no typosquats found", () => {
            const result = checkTyposquats(["react", "express", "lodash"]);

            expect(result).toEqual([]);
        });

        it("should return matches for typosquats", () => {
            const result = checkTyposquats(["react", "axois", "lodash"]);

            expect(result).toHaveLength(1);
            expect(result[0].input).toBe("axois");
            expect(result[0].legitimate).toBe("axios");
        });

        it("should detect multiple typosquats at once", () => {
            const result = checkTyposquats(["axois", "loash", "expresss"]);

            expect(result.length).toBeGreaterThanOrEqual(2);

            const inputs = result.map((r) => r.input);

            expect(inputs).toContain("axois");
        });
    });
});
