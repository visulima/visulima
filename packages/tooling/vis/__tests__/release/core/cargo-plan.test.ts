import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { nextRequirement, rewriteCargoRequirements } from "../../../src/release/core/cargo-plan";

// Built with resolve() so the keys match what the code computes on every platform.
const WS_A = resolve("ws", "a");
const WS_B = resolve("ws", "b");

/**
 * Cargo requirement semantics. A bare `"0.1.0"` means `^0.1.0`, so it is not
 * an exact pin. Only a requirement that stops accepting the new version moves.
 */
describe("cargo-plan: nextRequirement", () => {
    it("moves a bare 0.x requirement when a minor bump leaves its caret range", () => {
        expect.hasAssertions();

        expect(nextRequirement("0.1.0", "0.2.0")).toBe("0.2.0");
    });

    it("keeps a requirement that still accepts the new version", () => {
        expect.hasAssertions();

        expect(nextRequirement("0.1.0", "0.1.5")).toBeUndefined();
        expect(nextRequirement("^1.0", "1.2.0")).toBeUndefined();
        expect(nextRequirement("*", "9.9.9")).toBeUndefined();
    });

    it("keeps the operator when it has to move", () => {
        expect.hasAssertions();

        expect(nextRequirement("^1.0", "2.0.0")).toBe("^2.0.0");
        expect(nextRequirement("~1.2.0", "1.3.0")).toBe("~1.3.0");
        expect(nextRequirement("=1.0.0", "1.0.1")).toBe("=1.0.1");
    });
});

describe("cargo-plan: rewriteCargoRequirements", () => {
    const dirs = new Map([[WS_A, "0.2.0"]]);

    it("rewrites an inline path dependency and leaves the rest of the line alone", () => {
        expect.hasAssertions();

        const raw = "[dependencies]\na = { path = \"../a\", version = \"0.1.0\", features = [\"x\"] }\nserde = \"1\"\n";
        const result = rewriteCargoRequirements(raw, WS_B, dirs);

        expect(result.content).toBe("[dependencies]\na = { path = \"../a\", version = \"0.2.0\", features = [\"x\"] }\nserde = \"1\"\n");
        expect(result.warnings).toStrictEqual([]);
    });

    it("rewrites the [dependencies.name] table form", () => {
        expect.hasAssertions();

        const raw = "[dependencies.a]\npath = \"../a\"\nversion = \"0.1.0\"\n";

        expect(rewriteCargoRequirements(raw, WS_B, dirs).content).toBe("[dependencies.a]\npath = \"../a\"\nversion = \"0.2.0\"\n");
    });

    it("rewrites [workspace.dependencies] and target-specific tables", () => {
        expect.hasAssertions();

        const raw = "[workspace.dependencies]\na = { path = \"../a\", version = \"0.1.0\" }\n\n[target.'cfg(unix)'.dependencies]\na = { path = \"../a\", version = \"0.1.0\" }\n";
        const result = rewriteCargoRequirements(raw, WS_B, new Map([[WS_A, "0.2.0"]]));

        expect(result.content).toBe(
            "[workspace.dependencies]\na = { path = \"../a\", version = \"0.2.0\" }\n\n[target.'cfg(unix)'.dependencies]\na = { path = \"../a\", version = \"0.2.0\" }\n",
        );
    });

    it("leaves compound requirements alone with a warning", () => {
        expect.hasAssertions();

        const raw = "[dependencies]\na = { path = \"../a\", version = \">=0.1, <0.2\" }\n";
        const result = rewriteCargoRequirements(raw, WS_B, dirs);

        expect(result.content).toBeUndefined();
        expect(result.warnings).toHaveLength(1);
    });

    it("does not touch a dependency that points outside the released crates", () => {
        expect.hasAssertions();

        const raw = "[dependencies]\nother = { path = \"../other\", version = \"0.1.0\" }\n";

        expect(rewriteCargoRequirements(raw, WS_B, dirs).content).toBeUndefined();
    });
});
