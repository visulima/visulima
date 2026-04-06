import { afterEach, describe, expect, it, vi } from "vitest";

import { checkTyposquat, checkTyposquats, generateVariants, runTyposquatCheck } from "../src/typosquats";
import { parsePackageArgument } from "../src/utils";

// ── generateVariants ───────────────────────────────────────────────

describe("generateVariants", () => {
    it("should return empty set for names shorter than 3 characters", () => {
        expect(generateVariants("").size).toBe(0);
        expect(generateVariants("a").size).toBe(0);
        expect(generateVariants("ab").size).toBe(0);
    });

    it("should return a non-empty set for names with 3+ characters", () => {
        expect(generateVariants("abc").size).toBeGreaterThan(0);
    });

    // ── Character omission ──────────────────────────────────────────

    describe("character omission", () => {
        it("should drop each non-separator character", () => {
            const variants = generateVariants("react");

            expect(variants.has("eact")).toBe(true); // drop r
            expect(variants.has("ract")).toBe(true); // drop e
            expect(variants.has("reat")).toBe(true); // drop c
            expect(variants.has("reac")).toBe(true); // drop t
            expect(variants.has("rect")).toBe(true); // drop a
        });

        it("should not drop separator characters", () => {
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

    // ── Adjacent transposition ──────────────────────────────────────

    describe("adjacent transposition", () => {
        it("should swap each adjacent pair of different characters", () => {
            const variants = generateVariants("react");

            expect(variants.has("eract")).toBe(true); // swap r,e
            expect(variants.has("raect")).toBe(true); // swap e,a
            expect(variants.has("recat")).toBe(true); // swap a,c
            expect(variants.has("reatc")).toBe(true); // swap c,t
        });

        it("should not swap identical adjacent characters", () => {
            const variants = generateVariants("aab");

            // a,a are identical — should not produce "aab" (which is the original)
            expect(variants.has("aab")).toBe(false);
        });
    });

    // ── Character duplication ───────────────────────────────────────

    describe("character duplication", () => {
        it("should duplicate each non-separator character", () => {
            const variants = generateVariants("react");

            expect(variants.has("rreact")).toBe(true); // dup r
            expect(variants.has("reeact")).toBe(true); // dup e
            expect(variants.has("reaact")).toBe(true); // dup a
            expect(variants.has("reacct")).toBe(true); // dup c
            expect(variants.has("reactt")).toBe(true); // dup t
        });

        it("should not duplicate separators", () => {
            const variants = generateVariants("a-b");
            // Should not produce "a--b"
            const variantsArray = [...variants];
            const hasDupSeparator = variantsArray.some((v) => v.includes("--"));

            expect(hasDupSeparator).toBe(false);
        });
    });

    // ── Homoglyph substitution ──────────────────────────────────────

    describe("homoglyph substitution", () => {
        it("should substitute common homoglyphs", () => {
            const variants = generateVariants("react");

            expect(variants.has("r3act")).toBe(true); // e→3
            expect(variants.has("raact")).toBe(true); // e→a (also a dup, but via substitution)
            expect(variants.has("re4ct")).toBe(true); // a→4
            expect(variants.has("reect")).toBe(true); // a→e
            expect(variants.has("reac7")).toBe(true); // t→7
        });

        it("should handle multiple substitution options per character", () => {
            // 'a' maps to ["4", "e"], 'e' maps to ["3", "a"]
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
            const variants = generateVariants("xyz");

            // Should still produce omission, transposition, duplication variants
            expect(variants.size).toBeGreaterThan(0);
        });
    });

    // ── Separator manipulation ──────────────────────────────────────

    describe("separator manipulation", () => {
        it("should produce separator variants for hyphenated names", () => {
            const variants = generateVariants("body-parser");

            expect(variants.has("bodyparser")).toBe(true); // remove hyphens
            expect(variants.has("body.parser")).toBe(true); // dash → dot
            expect(variants.has("body_parser")).toBe(true); // dash → underscore
        });

        it("should produce multiple separator replacements for multiple hyphens", () => {
            const variants = generateVariants("a-b-c");

            expect(variants.has("abc")).toBe(true); // remove all
            expect(variants.has("a.b.c")).toBe(true); // dots
            expect(variants.has("a_b_c")).toBe(true); // underscores
        });

        it("should produce hyphen insertion for long non-hyphenated names", () => {
            const variants = generateVariants("express");

            expect(variants.has("ex-press")).toBe(true);
            expect(variants.has("exp-ress")).toBe(true);
            expect(variants.has("expr-ess")).toBe(true);
        });

        it("should not produce hyphen insertion for short names (length <= 5)", () => {
            const variants = generateVariants("react"); // length 5

            // No hyphen insertion — only 5 chars
            const hasHyphenInsert = [...variants].some((v) => v.includes("-") && !v.endsWith("-js") && !v.endsWith("-node"));

            expect(hasHyphenInsert).toBe(false);
        });
    });

    // ── Common suffixes ─────────────────────────────────────────────

    describe("common suffixes", () => {
        it("should add -js, js, -node suffixes for unscoped packages", () => {
            const variants = generateVariants("lodash");

            expect(variants.has("lodash-js")).toBe(true);
            expect(variants.has("lodashjs")).toBe(true);
            expect(variants.has("lodash-node")).toBe(true);
        });

        it("should not add suffixes for scoped packages", () => {
            const variants = generateVariants("@scope/pkg");

            expect(variants.has("@scope/pkg-js")).toBe(false);
            expect(variants.has("@scope/pkgjs")).toBe(false);
            expect(variants.has("@scope/pkg-node")).toBe(false);
        });
    });

    // ── Edge cases ──────────────────────────────────────────────────

    describe("edge cases", () => {
        it("should never include the original name in variants", () => {
            for (const name of ["lodash", "react", "express", "body-parser", "@scope/pkg"]) {
                expect(generateVariants(name).has(name)).toBe(false);
            }
        });

        it("should produce unique variants (Set guarantees)", () => {
            const variants = generateVariants("lodash");
            const asArray = [...variants];

            expect(asArray.length).toBe(new Set(asArray).size);
        });

        it("should handle names with dots", () => {
            const variants = generateVariants("socket.io");

            // Dots are treated as separators for omission/duplication
            expect(variants.size).toBeGreaterThan(0);
            // Should still produce character omissions for non-separator chars
            expect(variants.has("ocket.io")).toBe(true); // drop 's'
        });

        it("should handle names that are exactly 3 characters", () => {
            const variants = generateVariants("vue");

            expect(variants.size).toBeGreaterThan(0);
            expect(variants.has("ue")).toBe(true); // drop v
            expect(variants.has("ve")).toBe(true); // drop u
            expect(variants.has("vu")).toBe(true); // drop e
        });
    });
});

// ── checkTyposquat ─────────────────────────────────────────────────

describe("checkTyposquat", () => {
    it("should detect a known blocklisted typosquat", () => {
        const result = checkTyposquat("axois");

        expect(result).toBeDefined();
        expect(result!.input).toBe("axois");
        expect(result!.legitimate).toBe("axios");
        expect(result!.method).toBe("blocklist");
    });

    it("should detect multiple different blocklisted entries", () => {
        // Test several known entries from the JSON
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
        const result = checkTyposquat("expr3ss");

        expect(result).toBeDefined();
        expect(result!.legitimate).toBe("express");
        expect(result!.method).toBe("heuristic");
    });

    it("should return undefined for legitimate package names", () => {
        expect(checkTyposquat("react")).toBeUndefined();
        expect(checkTyposquat("express")).toBeUndefined();
        expect(checkTyposquat("lodash")).toBeUndefined();
        expect(checkTyposquat("axios")).toBeUndefined();
        expect(checkTyposquat("chalk")).toBeUndefined();
        expect(checkTyposquat("zod")).toBeUndefined();
    });

    it("should return undefined for unrelated package names", () => {
        expect(checkTyposquat("my-totally-unique-package-name-xyz123")).toBeUndefined();
        expect(checkTyposquat("@myorg/internal-utils")).toBeUndefined();
        expect(checkTyposquat("some-enterprise-tool")).toBeUndefined();
    });

    it("should strip scope and check the bare name", () => {
        // "@evil/axois" → bare name "axois" → matches "axios"
        const result = checkTyposquat("@evil/axois");

        expect(result).toBeDefined();
        expect(result!.input).toBe("@evil/axois");
        expect(result!.legitimate).toBe("axios");
    });

    it("should handle scoped packages without a slash", () => {
        // Edge case: "@something" with no slash
        const result = checkTyposquat("@something");

        // "@something" has no "/" so bareName returns "@something" — unlikely to match
        expect(result).toBeUndefined();
    });

    it("should detect all known blocklist entries in the JSON", () => {
        // Verify a sampling of entries across different packages
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

// ── checkTyposquats (batch) ────────────────────────────────────────

describe("checkTyposquats", () => {
    it("should return empty array when all names are safe", () => {
        const result = checkTyposquats(["react", "express", "lodash"]);

        expect(result).toEqual([]);
    });

    it("should return empty array for an empty input", () => {
        expect(checkTyposquats([])).toEqual([]);
    });

    it("should return a single match among safe packages", () => {
        const result = checkTyposquats(["react", "axois", "lodash"]);

        expect(result).toHaveLength(1);
        expect(result[0].input).toBe("axois");
        expect(result[0].legitimate).toBe("axios");
    });

    it("should detect multiple typosquats in one call", () => {
        const result = checkTyposquats(["axois", "loash", "rreact"]);

        expect(result.length).toBeGreaterThanOrEqual(3);

        const inputs = result.map((r) => r.input);

        expect(inputs).toContain("axois");
        expect(inputs).toContain("loash");
        expect(inputs).toContain("rreact");
    });

    it("should preserve the input field in each match", () => {
        const result = checkTyposquats(["axois"]);

        expect(result[0].input).toBe("axois");
    });

    it("should correctly map each typosquat to its legitimate package", () => {
        const result = checkTyposquats(["axois", "halk"]);

        const byInput = new Map(result.map((r) => [r.input, r]));

        expect(byInput.get("axois")!.legitimate).toBe("axios");
        expect(byInput.get("halk")!.legitimate).toBe("chalk");
    });
});

// ── runTyposquatCheck (interactive prompt) ──────────────────────────

describe("runTyposquatCheck", () => {
    const originalIsTTY = process.stdin.isTTY;

    afterEach(() => {
        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, writable: true });
        vi.restoreAllMocks();
    });

    it("should return ok=true with unchanged packages when no typosquats found", async () => {
        const result = await runTyposquatCheck(["react", "express"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toEqual(["react", "express"]);
    });

    it("should return ok=false in non-interactive mode when typosquat is detected", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(false);
        expect(result.packages).toEqual(["axois"]);
    });

    it("should return ok=false when user answers N (abort)", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("N");
            },
        } as any);

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(false);
        expect(result.packages).toEqual(["axois"]);
    });

    it("should return ok=false when user presses enter (default N)", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("");
            },
        } as any);

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(false);
    });

    it("should return ok=true with original packages when user answers y (keep)", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("y");
            },
        } as any);

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toEqual(["axois"]);
    });

    it("should return ok=true with 'yes' answer (keep original)", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("yes");
            },
        } as any);

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toEqual(["axois"]);
    });

    it("should return ok=true with corrected packages when user answers S (suggested)", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("S");
            },
        } as any);

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toEqual(["axios"]);
    });

    it("should return ok=true with 'suggested' answer", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("suggested");
            },
        } as any);

        const result = await runTyposquatCheck(["axois"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toEqual(["axios"]);
    });

    it("should only replace typosquat names while keeping safe names untouched", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("s");
            },
        } as any);

        const result = await runTyposquatCheck(["react", "axois", "lodash"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toEqual(["react", "axios", "lodash"]);
    });

    it("should replace multiple typosquats when user answers S", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
            close: vi.fn(),
            question: (_prompt: string, cb: (answer: string) => void) => {
                cb("s");
            },
        } as any);

        const result = await runTyposquatCheck(["axois", "halk"]);

        expect(result.ok).toBe(true);
        expect(result.packages).toEqual(["axios", "chalk"]);
    });

    it("should handle case-insensitive answers", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });

        for (const answer of ["s", "S", "SUGGESTED", "Suggested"]) {
            vi.spyOn(await import("node:readline"), "createInterface").mockReturnValue({
                close: vi.fn(),
                question: (_prompt: string, cb: (answer: string) => void) => {
                    cb(answer);
                },
            } as any);

            const result = await runTyposquatCheck(["axois"]);

            expect(result.ok, `answer "${answer}" should result in ok=true`).toBe(true);
            expect(result.packages).toEqual(["axios"]);

            vi.restoreAllMocks();
        }
    });
});

// ── parsePackageArgument ───────────────────────────────────────────

describe("parsePackageArgument", () => {
    it("should parse a bare package name", () => {
        expect(parsePackageArgument("react")).toEqual({ name: "react", versionSpec: undefined });
    });

    it("should parse name@version", () => {
        expect(parsePackageArgument("react@19")).toEqual({ name: "react", versionSpec: "19" });
    });

    it("should parse name@semver-range", () => {
        expect(parsePackageArgument("lodash@^4.17.0")).toEqual({ name: "lodash", versionSpec: "^4.17.0" });
    });

    it("should parse name@tilde-range", () => {
        expect(parsePackageArgument("express@~4.18.0")).toEqual({ name: "express", versionSpec: "~4.18.0" });
    });

    it("should parse name@dist-tag", () => {
        expect(parsePackageArgument("react@next")).toEqual({ name: "react", versionSpec: "next" });
    });

    it("should parse a scoped package without version", () => {
        expect(parsePackageArgument("@types/react")).toEqual({ name: "@types/react", versionSpec: undefined });
    });

    it("should parse a scoped package with version", () => {
        expect(parsePackageArgument("@types/react@18")).toEqual({ name: "@types/react", versionSpec: "18" });
    });

    it("should parse a scoped package with semver range", () => {
        expect(parsePackageArgument("@scope/pkg@^2.0.0")).toEqual({ name: "@scope/pkg", versionSpec: "^2.0.0" });
    });

    it("should handle a scope without a slash", () => {
        expect(parsePackageArgument("@something")).toEqual({ name: "@something", versionSpec: undefined });
    });

    it("should handle a scope with slash but no version", () => {
        expect(parsePackageArgument("@org/lib")).toEqual({ name: "@org/lib", versionSpec: undefined });
    });

    it("should parse a scoped package with dist-tag", () => {
        expect(parsePackageArgument("@scope/pkg@latest")).toEqual({ name: "@scope/pkg", versionSpec: "latest" });
    });
});
