import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkTyposquat, checkTyposquats, generateVariants, runTyposquatCheck, scanDepsForTyposquats } from "../../src/security/typosquats";
import { parsePackageArgument } from "../../src/util/utils";

// Mock node:readline so we can control createInterface in interactive tests
let mockCreateInterface: ReturnType<typeof vi.fn> | undefined;

vi.mock(import("node:readline"), async (importOriginal) => {
    const original = await importOriginal();

    return {
        ...original,
        createInterface: (...args: unknown[]) => {
            if (mockCreateInterface) {
                return mockCreateInterface(...args) as ReturnType<typeof original.createInterface>;
            }

            return original.createInterface(...(args as Parameters<typeof original.createInterface>));
        },
    };
});

describe(generateVariants, () => {
    it("should return empty set for names shorter than 3 characters", () => {
        expect.assertions(3);

        expect(generateVariants("").size).toBe(0);
        expect(generateVariants("a").size).toBe(0);
        expect(generateVariants("ab").size).toBe(0);
    });

    it("should return a non-empty set for names with 3+ characters", () => {
        expect.assertions(1);

        expect(generateVariants("abc").size).toBeGreaterThan(0);
    });

    describe("character omission", () => {
        it("should drop each non-separator character", () => {
            expect.assertions(5);

            const variants = generateVariants("react");

            expect(variants.has("eact")).toBe(true); // drop r
            expect(variants.has("ract")).toBe(true); // drop e
            expect(variants.has("reat")).toBe(true); // drop c
            expect(variants.has("reac")).toBe(true); // drop t
            expect(variants.has("rect")).toBe(true); // drop a
        });

        it("should not drop separator characters", () => {
            expect.assertions(3);

            const variants = generateVariants("a-b-c");

            // Dropping '-' at index 1 would give "ab-c" — that should NOT appear
            // as a simple omission (though it might appear from other heuristics).
            // The key check: separators are skipped in the omission loop.
            // Verify that we DO get omission of non-separator chars:
            expect(variants.has("-b-c")).toBe(true); // drop 'a'
            expect(variants.has("a--c")).toBe(true); // drop 'b'
            expect(variants.has("a-b-")).toBe(true); // drop 'c'
        });
    });

    describe("adjacent transposition", () => {
        it("should swap each adjacent pair of different characters", () => {
            expect.assertions(4);

            const variants = generateVariants("react");

            expect(variants.has("eract")).toBe(true); // swap r,e
            expect(variants.has("raect")).toBe(true); // swap e,a
            expect(variants.has("recat")).toBe(true); // swap a,c
            expect(variants.has("reatc")).toBe(true); // swap c,t
        });

        it("should not swap identical adjacent characters", () => {
            expect.assertions(1);

            const variants = generateVariants("aab");

            // a,a are identical — should not produce "aab" (which is the original)
            expect(variants.has("aab")).toBe(false);
        });
    });

    describe("character duplication", () => {
        it("should duplicate each non-separator character", () => {
            expect.assertions(5);

            const variants = generateVariants("react");

            expect(variants.has("rreact")).toBe(true); // dup r
            expect(variants.has("reeact")).toBe(true); // dup e
            expect(variants.has("reaact")).toBe(true); // dup a
            expect(variants.has("reacct")).toBe(true); // dup c
            expect(variants.has("reactt")).toBe(true); // dup t
        });

        it("should not duplicate separators", () => {
            expect.assertions(1);

            const variants = generateVariants("a-b");
            // Should not produce "a--b"
            const variantsArray = [...variants];
            const hasDupSeparator = variantsArray.some((v) => v.includes("--"));

            expect(hasDupSeparator).toBe(false);
        });
    });

    describe("homoglyph substitution", () => {
        it("should substitute common homoglyphs", () => {
            expect.assertions(5);

            const variants = generateVariants("react");

            expect(variants.has("r3act")).toBe(true); // e→3
            expect(variants.has("raact")).toBe(true); // e→a (also a dup, but via substitution)
            expect(variants.has("re4ct")).toBe(true); // a→4
            expect(variants.has("reect")).toBe(true); // a→e
            expect(variants.has("reac7")).toBe(true); // t→7
        });

        it("should handle multiple substitution options per character", () => {
            // 'a' maps to ["4", "e"], 'e' maps to ["3", "a"]
            expect.assertions(6);

            const variants = generateVariants("aes");

            expect(variants.has("4es")).toBe(true); // a→4
            expect(variants.has("ees")).toBe(true); // a→e
            expect(variants.has("a3s")).toBe(true); // e→3
            expect(variants.has("aas")).toBe(true); // e→a
            expect(variants.has("ae5")).toBe(true); // s→5
            expect(variants.has("aez")).toBe(true); // s→z
        });

        it("should handle characters without substitutions", () => {
            // 'x', 'y', 'z' have no substitution entries except z (which is a sub for s)
            expect.assertions(1);

            const variants = generateVariants("xyz");

            // Should still produce omission, transposition, duplication variants
            expect(variants.size).toBeGreaterThan(0);
        });
    });

    describe("separator manipulation", () => {
        it("should produce separator variants for hyphenated names", () => {
            expect.assertions(3);

            const variants = generateVariants("body-parser");

            expect(variants.has("bodyparser")).toBe(true); // remove hyphens
            expect(variants.has("body.parser")).toBe(true); // dash → dot
            expect(variants.has("body_parser")).toBe(true); // dash → underscore
        });

        it("should produce multiple separator replacements for multiple hyphens", () => {
            expect.assertions(3);

            const variants = generateVariants("a-b-c");

            expect(variants.has("abc")).toBe(true); // remove all
            expect(variants.has("a.b.c")).toBe(true); // dots
            expect(variants.has("a_b_c")).toBe(true); // underscores
        });

        it("should produce all separator insertions for long non-hyphenated names", () => {
            expect.assertions(4);

            const variants = generateVariants("express");

            expect(variants.has("ex-press")).toBe(true);
            expect(variants.has("ex.press")).toBe(true);
            expect(variants.has("ex_press")).toBe(true);
            expect(variants.has("exp-ress")).toBe(true);
        });

        it("should treat underscores as separators", () => {
            expect.assertions(3);

            const variants = generateVariants("a_b_c");

            expect(variants.has("abc")).toBe(true); // remove all
            expect(variants.has("a-b-c")).toBe(true); // underscores → hyphens
            expect(variants.has("a.b.c")).toBe(true); // underscores → dots
        });

        it("should not produce separator insertion for short names (length <= 5)", () => {
            expect.assertions(1);

            const variants = generateVariants("react"); // length 5

            // No separator insertion — only 5 chars
            const hasSepInsert = [...variants].some(
                (v) => (v.includes("-") || v.includes(".") || v.includes("_")) && !v.endsWith("-js") && !v.endsWith("-node"),
            );

            expect(hasSepInsert).toBe(false);
        });

        it("should not transpose characters across separators", () => {
            expect.assertions(2);

            const variants = generateVariants("body-parser");

            // "bodyp-arser" would mean swapping '-' and 'p' — should not happen
            expect(variants.has("bodyp-arser")).toBe(false);
            // "bod-yparser" would mean swapping 'y' and '-' — should not happen
            expect(variants.has("bod-yparser")).toBe(false);
        });
    });

    describe("common suffixes", () => {
        it("should add -js, js, -node suffixes for unscoped packages", () => {
            expect.assertions(3);

            const variants = generateVariants("lodash");

            expect(variants.has("lodash-js")).toBe(true);
            expect(variants.has("lodashjs")).toBe(true);
            expect(variants.has("lodash-node")).toBe(true);
        });

        it("should not add suffixes for scoped packages", () => {
            expect.assertions(3);

            const variants = generateVariants("@scope/pkg");

            expect(variants.has("@scope/pkg-js")).toBe(false);
            expect(variants.has("@scope/pkgjs")).toBe(false);
            expect(variants.has("@scope/pkg-node")).toBe(false);
        });
    });

    describe("scoped-package brand-jacks", () => {
        it("should emit the scope as a standalone variant", () => {
            expect.assertions(1);

            const variants = generateVariants("@tanstack/start");

            expect(variants.has("tanstack")).toBe(true);
        });

        it("should emit scope+sub combinations with each separator", () => {
            expect.assertions(8);

            const variants = generateVariants("@tanstack/start");

            expect(variants.has("tanstack-start")).toBe(true);
            expect(variants.has("tanstack.start")).toBe(true);
            expect(variants.has("tanstack_start")).toBe(true);
            expect(variants.has("tanstackstart")).toBe(true);
            expect(variants.has("start-tanstack")).toBe(true);
            expect(variants.has("start.tanstack")).toBe(true);
            expect(variants.has("start_tanstack")).toBe(true);
            expect(variants.has("starttanstack")).toBe(true);
        });

        it("should emit scope+app/cli/sdk-style suffix variants", () => {
            expect.assertions(3);

            const variants = generateVariants("@tanstack/start");

            expect(variants.has("tanstack-app")).toBe(true);
            expect(variants.has("tanstack-cli")).toBe(true);
            expect(variants.has("tanstack-sdk")).toBe(true);
        });

        it("should emit sub-scope-suffix variants (e.g. start-tanstack-app)", () => {
            expect.assertions(2);

            const variants = generateVariants("@tanstack/start");

            expect(variants.has("start-tanstack-app")).toBe(true);
            expect(variants.has("app-tanstack-start")).toBe(true);
        });

        it("should not emit the bare sub alone (too generic, false positives)", () => {
            // `start` on its own is too common to flag.
            expect.assertions(1);

            const variants = generateVariants("@tanstack/start");

            expect(variants.has("start")).toBe(false);
        });

        it("should not emit brand-jack variants for malformed scoped names", () => {
            // No slash, or empty scope/sub → skip brand-jack generation. (Other
            // heuristics may still fire, e.g. character omission can produce
            // `tanstack` from `@tanstack` — that's unrelated to brand-jacks.)
            expect.assertions(2);

            const noSlash = generateVariants("@tanstack");
            const emptyScope = generateVariants("@/start");

            // Brand-jack-specific variants should not appear.
            expect(noSlash.has("tanstack-app")).toBe(false);
            expect(emptyScope.has("start-app")).toBe(false);
        });
    });

    describe("edge cases", () => {
        it("should never include the original name in variants", () => {
            // 5 names × 1 assertion each = 5
            expect.assertions(5);

            for (const name of ["lodash", "react", "express", "body-parser", "@scope/pkg"]) {
                expect(generateVariants(name).has(name)).toBe(false);
            }
        });

        it("should produce unique variants (Set guarantees)", () => {
            expect.assertions(1);

            const variants = generateVariants("lodash");
            const asArray = [...variants];

            expect(asArray).toHaveLength(new Set(asArray).size);
        });

        it("should handle names with dots", () => {
            expect.assertions(2);

            const variants = generateVariants("socket.io");

            // Dots are treated as separators for omission/duplication
            expect(variants.size).toBeGreaterThan(0);
            // Should still produce character omissions for non-separator chars
            expect(variants.has("ocket.io")).toBe(true); // drop 's'
        });

        it("should handle names that are exactly 3 characters", () => {
            expect.assertions(4);

            const variants = generateVariants("vue");

            expect(variants.size).toBeGreaterThan(0);
            expect(variants.has("ue")).toBe(true); // drop v
            expect(variants.has("ve")).toBe(true); // drop u
            expect(variants.has("vu")).toBe(true); // drop e
        });
    });
});

describe(checkTyposquat, () => {
    it("should detect a known blocklisted typosquat", () => {
        expect.assertions(4);

        const result = checkTyposquat("axois");

        expect(result).toBeDefined();
        expect(result!.input).toBe("axois");
        expect(result!.legitimate).toBe("axios");
        expect(result!.method).toBe("blocklist");
    });

    it("should detect multiple different blocklisted entries", () => {
        // 5 cases × 2 assertions each = 10
        expect.assertions(10);

        const cases: [string, string][] = [
            ["loash", "lodash"],
            ["rreact", "react"],
            ["expresss", "express"],
            ["halk", "chalk"],
            ["zob", "zod"],
        ];

        for (const [typo, expected] of cases) {
            const result = checkTyposquat(typo);

            expect(result, `Expected "${typo}" to match "${expected}"`).toBeDefined();
            expect(result!.legitimate).toBe(expected);
        }
    });

    it("should detect heuristic typosquats not in the blocklist", () => {
        // "expresz" is a substitution variant of "express" (s→z) that likely
        // isn't in the blocklist but the heuristic should catch it
        expect.assertions(3);

        const result = checkTyposquat("expr3ss");

        expect(result).toBeDefined();
        expect(result!.legitimate).toBe("express");
        expect(result!.method).toBe("heuristic");
    });

    it("should return undefined for legitimate package names", () => {
        expect.assertions(6);

        expect(checkTyposquat("react")).toBeUndefined();
        expect(checkTyposquat("express")).toBeUndefined();
        expect(checkTyposquat("lodash")).toBeUndefined();
        expect(checkTyposquat("axios")).toBeUndefined();
        expect(checkTyposquat("chalk")).toBeUndefined();
        expect(checkTyposquat("zod")).toBeUndefined();
    });

    it("should return undefined for unrelated package names", () => {
        expect.assertions(3);

        expect(checkTyposquat("my-totally-unique-package-name-xyz123")).toBeUndefined();
        expect(checkTyposquat("@myorg/internal-utils")).toBeUndefined();
        expect(checkTyposquat("some-enterprise-tool")).toBeUndefined();
    });

    it("should strip scope and check the bare name", () => {
        // "@evil/axois" → bare name "axois" → matches "axios"
        expect.assertions(3);

        const result = checkTyposquat("@evil/axois");

        expect(result).toBeDefined();
        expect(result!.input).toBe("@evil/axois");
        expect(result!.legitimate).toBe("axios");
    });

    it("should handle scoped packages without a slash", () => {
        // Edge case: "@something" with no slash
        expect.assertions(1);

        const result = checkTyposquat("@something");

        // "@something" has no "/" so bareName returns "@something" — unlikely to match
        expect(result).toBeUndefined();
    });

    it("should detect entries from the manual blocklist file", () => {
        // Seeded in data/typosquats-manual.json; never written by sync-blocklist.
        // 4 squats × 3 assertions each = 12
        expect.assertions(12);

        const cases: [string, string][] = [
            ["tanstack", "@tanstack/start"],
            ["tanstack-app", "@tanstack/start"],
            ["tanstack-start", "@tanstack/start"],
            ["start-tanstack-app", "@tanstack/start"],
        ];

        for (const [typo, expected] of cases) {
            const result = checkTyposquat(typo);

            expect(result, `"${typo}" should be detected as typosquat of "${expected}"`).toBeDefined();
            expect(result!.legitimate).toBe(expected);
            expect(result!.method).toBe("blocklist");
        }
    });

    it("should detect all known blocklist entries in the JSON", () => {
        // 6 samples × 3 assertions each = 18
        expect.assertions(18);

        const samples: [string, string][] = [
            ["axxios", "axios"],
            ["bable", "babel"],
            ["reactjs", "react"],
            ["dot-env", "dotenv"],
            ["crossenv", "cross-env"],
            ["lodash-node", "lodash"],
        ];

        for (const [typo, expected] of samples) {
            const result = checkTyposquat(typo);

            expect(result, `"${typo}" should be detected as typosquat of "${expected}"`).toBeDefined();
            expect(result!.legitimate).toBe(expected);
            expect(result!.method).toBe("blocklist");
        }
    });
});

describe(checkTyposquats, () => {
    it("should return empty array when all names are safe", () => {
        expect.assertions(1);

        const result = checkTyposquats(["react", "express", "lodash"]);

        expect(result).toStrictEqual([]);
    });

    it("should return empty array for an empty input", () => {
        expect.assertions(1);

        expect(checkTyposquats([])).toStrictEqual([]);
    });

    it("should return a single match among safe packages", () => {
        expect.assertions(3);

        const result = checkTyposquats(["react", "axois", "lodash"]);

        expect(result).toHaveLength(1);
        expect(result[0].input).toBe("axois");
        expect(result[0].legitimate).toBe("axios");
    });

    it("should detect multiple typosquats in one call", () => {
        expect.assertions(4);

        const result = checkTyposquats(["axois", "loash", "rreact"]);

        expect(result.length).toBeGreaterThanOrEqual(3);

        const inputs = result.map((r) => r.input);

        expect(inputs).toContain("axois");
        expect(inputs).toContain("loash");
        expect(inputs).toContain("rreact");
    });

    it("should preserve the input field in each match", () => {
        expect.assertions(1);

        const result = checkTyposquats(["axois"]);

        expect(result[0].input).toBe("axois");
    });

    it("should correctly map each typosquat to its legitimate package", () => {
        expect.assertions(2);

        const result = checkTyposquats(["axois", "halk"]);

        const byInput = new Map(result.map((r) => [r.input, r]));

        expect(byInput.get("axois")!.legitimate).toBe("axios");
        expect(byInput.get("halk")!.legitimate).toBe("chalk");
    });
});

describe(runTyposquatCheck, () => {
    const originalIsTTY = process.stdin.isTTY;

    afterEach(() => {
        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, writable: true });
        mockCreateInterface = undefined;
    });

    const mockRl = (answer: string) => {
        mockCreateInterface = vi.fn().mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb(answer);
            },
        });
    };

    it("should return ok=true with unchanged packages when no typosquats found", async () => {
        expect.assertions(2);

        const result = await runTyposquatCheck(["react", "express"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toStrictEqual(["react", "express"]);
    });

    it("should return ok=false in non-interactive mode when typosquat is detected", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(false);
        expect(result.packages).toStrictEqual(["axois"]);
    });

    it("should return ok=false when user answers N (abort)", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("N");

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(false);
        expect(result.packages).toStrictEqual(["axois"]);
    });

    it("should return ok=false when user presses enter (default N)", async () => {
        expect.assertions(1);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("");

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(false);
    });

    it("should return ok=true with original packages when user answers y (keep)", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("y");

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toStrictEqual(["axois"]);
    });

    it("should return ok=true with 'yes' answer (keep original)", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("yes");

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toStrictEqual(["axois"]);
    });

    it("should return ok=true with corrected packages when user answers S (suggested)", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("S");

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toStrictEqual(["axios"]);
    });

    it("should return ok=true with 'suggested' answer", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("suggested");

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toStrictEqual(["axios"]);
    });

    it("should only replace typosquat names while keeping safe names untouched", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("s");

        const result = await runTyposquatCheck(["react", "axois", "lodash"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toStrictEqual(["react", "axios", "lodash"]);
    });

    it("should replace multiple typosquats when user answers S", async () => {
        expect.assertions(2);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        mockRl("s");

        const result = await runTyposquatCheck(["axois", "halk"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toStrictEqual(["axios", "chalk"]);
    });

    it("should handle case-insensitive answers", async () => {
        // 4 answers × 2 assertions each = 8
        expect.assertions(8);

        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        for (const answer of ["s", "S", "SUGGESTED", "Suggested"]) {
            mockRl(answer);

            const result = await runTyposquatCheck(["axois"]);

            expect(result.ok, `answer "${answer}" should result in ok=true`).toBe(true);
            expect(result.packages).toStrictEqual(["axios"]);
        }
    });
});

describe(parsePackageArgument, () => {
    it("should parse a bare package name", () => {
        expect.assertions(1);

        expect(parsePackageArgument("react")).toStrictEqual({ name: "react", versionSpec: undefined });
    });

    it("should parse name@version", () => {
        expect.assertions(1);

        expect(parsePackageArgument("react@19")).toStrictEqual({ name: "react", versionSpec: "19" });
    });

    it("should parse name@semver-range", () => {
        expect.assertions(1);

        expect(parsePackageArgument("lodash@^4.17.0")).toStrictEqual({ name: "lodash", versionSpec: "^4.17.0" });
    });

    it("should parse name@tilde-range", () => {
        expect.assertions(1);

        expect(parsePackageArgument("express@~4.18.0")).toStrictEqual({ name: "express", versionSpec: "~4.18.0" });
    });

    it("should parse name@dist-tag", () => {
        expect.assertions(1);

        expect(parsePackageArgument("react@next")).toStrictEqual({ name: "react", versionSpec: "next" });
    });

    it("should parse a scoped package without version", () => {
        expect.assertions(1);

        expect(parsePackageArgument("@types/react")).toStrictEqual({ name: "@types/react", versionSpec: undefined });
    });

    it("should parse a scoped package with version", () => {
        expect.assertions(1);

        expect(parsePackageArgument("@types/react@18")).toStrictEqual({ name: "@types/react", versionSpec: "18" });
    });

    it("should parse a scoped package with semver range", () => {
        expect.assertions(1);

        expect(parsePackageArgument("@scope/pkg@^2.0.0")).toStrictEqual({ name: "@scope/pkg", versionSpec: "^2.0.0" });
    });

    it("should handle a scope without a slash", () => {
        expect.assertions(1);

        expect(parsePackageArgument("@something")).toStrictEqual({ name: "@something", versionSpec: undefined });
    });

    it("should handle a scope with slash but no version", () => {
        expect.assertions(1);

        expect(parsePackageArgument("@org/lib")).toStrictEqual({ name: "@org/lib", versionSpec: undefined });
    });

    it("should parse a scoped package with dist-tag", () => {
        expect.assertions(1);

        expect(parsePackageArgument("@scope/pkg@latest")).toStrictEqual({ name: "@scope/pkg", versionSpec: "latest" });
    });
});

describe("checkTyposquats with allowlist", () => {
    it("should skip allowlisted packages", () => {
        expect.assertions(2);

        const result = checkTyposquats(["axois", "halk"], ["axois"]);

        expect(result).toHaveLength(1);
        expect(result[0].input).toBe("halk");
    });

    it("should skip all matches when all are allowlisted", () => {
        expect.assertions(1);

        const result = checkTyposquats(["axois", "halk"], ["axois", "halk"]);

        expect(result).toStrictEqual([]);
    });

    it("should behave normally when allowlist is empty", () => {
        expect.assertions(1);

        const result = checkTyposquats(["axois"], []);

        expect(result).toHaveLength(1);
    });

    it("should behave normally when allowlist is undefined", () => {
        expect.assertions(1);

        const result = checkTyposquats(["axois"]);

        expect(result).toHaveLength(1);
    });
});

describe(scanDepsForTyposquats, () => {
    const originalIsTTY = process.stdin.isTTY;
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-typosquat-test-"));
    });

    afterEach(() => {
        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, writable: true });

        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("should return true when no package.json exists", async () => {
        expect.assertions(1);

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(true);
    });

    it("should return true when package.json has no dependencies", async () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(true);
    });

    it("should return true when all dependencies are safe", async () => {
        expect.assertions(1);

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                dependencies: { express: "^4.0.0", react: "^18.0.0" },
                name: "test",
            }),
        );

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(true);
    });

    it("should return false in non-TTY mode when a typosquat is found", async () => {
        expect.assertions(1);

        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                dependencies: { axois: "^1.0.0" },
                name: "test",
            }),
        );

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(false);
    });

    it("should skip allowlisted deps", async () => {
        expect.assertions(1);

        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                dependencies: { axois: "^1.0.0" },
                name: "test",
            }),
        );

        const result = await scanDepsForTyposquats(tmpDir, ["axois"]);

        expect(result).toBe(true);
    });

    it("should scan all dependency types", async () => {
        expect.assertions(1);

        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                devDependencies: { axois: "^1.0.0" },
                name: "test",
            }),
        );

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(false);
    });

    it("should detect typosquats in npm: alias targets", async () => {
        expect.assertions(1);

        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                dependencies: { "my-axios": "npm:axois@^1.0.0" },
                name: "test",
            }),
        );

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(false);
    });

    it("should detect typosquats in pnpm: alias targets", async () => {
        expect.assertions(1);

        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                dependencies: { "my-react": "pnpm:rreact@^18.0.0" },
                name: "test",
            }),
        );

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(false);
    });

    it("should not flag non-alias version specifiers", async () => {
        expect.assertions(1);

        writeFileSync(
            join(tmpDir, "package.json"),
            JSON.stringify({
                dependencies: { express: "~4.18.0", react: "^18.0.0" },
                name: "test",
            }),
        );

        const result = await scanDepsForTyposquats(tmpDir);

        expect(result).toBe(true);
    });
});
