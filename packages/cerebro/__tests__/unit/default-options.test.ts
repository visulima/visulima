// packages/cerebro/__tests__/unit/default-options.test.ts
import { describe, expect, it } from "vitest";

import defaultOptions from "../../src/default-options";

describe("default-options", () => {
    it("should export an array of options", () => {
        expect.assertions(2);

        expect(Array.isArray(defaultOptions)).toBe(true);
        expect(defaultOptions.length).toBeGreaterThan(0);
    });

    it("should have all options with required properties", () => {
        expect.assertions(defaultOptions.length * 3);

        defaultOptions.forEach((option) => {
            expect(option).toHaveProperty("name");
            expect(option).toHaveProperty("description");
            expect(option).toHaveProperty("type");
        });
    });

    it("should have all options in global group", () => {
        expect.assertions(defaultOptions.length);

        defaultOptions.forEach((option) => {
            expect(option.group).toBe("global");
        });
    });

    it("should have verbose option", () => {
        expect.assertions(2);

        const verboseOption = defaultOptions.find((opt) => opt.name === "verbose");

        expect(verboseOption).toBeDefined();
        expect(verboseOption?.type).toBe(Boolean);
    });

    it("should have debug option", () => {
        expect.assertions(2);

        const debugOption = defaultOptions.find((opt) => opt.name === "debug");

        expect(debugOption).toBeDefined();
        expect(debugOption?.type).toBe(Boolean);
    });

    it("should have help option with alias", () => {
        expect.assertions(3);

        const helpOption = defaultOptions.find((opt) => opt.name === "help");

        expect(helpOption).toBeDefined();
        expect(helpOption?.type).toBe(Boolean);
        expect(helpOption?.alias).toBe("h");
    });

    it("should have quiet option with alias", () => {
        expect.assertions(3);

        const quietOption = defaultOptions.find((opt) => opt.name === "quiet");

        expect(quietOption).toBeDefined();
        expect(quietOption?.type).toBe(Boolean);
        expect(quietOption?.alias).toBe("q");
    });

    it("should have version option with alias", () => {
        expect.assertions(3);

        const versionOption = defaultOptions.find((opt) => opt.name === "version");

        expect(versionOption).toBeDefined();
        expect(versionOption?.type).toBe(Boolean);
        expect(versionOption?.alias).toBe("V");
    });

    it("should have no-color option", () => {
        expect.assertions(2);

        const noColorOption = defaultOptions.find((opt) => opt.name === "no-color");

        expect(noColorOption).toBeDefined();
        expect(noColorOption?.type).toBe(Boolean);
    });

    it("should have color option", () => {
        expect.assertions(2);

        const colorOption = defaultOptions.find((opt) => opt.name === "color");

        expect(colorOption).toBeDefined();
        expect(colorOption?.type).toBe(Boolean);
    });

    it("should have exactly 7 default options", () => {
        expect.assertions(1);

        expect(defaultOptions).toHaveLength(7);
    });

    it("should have all options as Boolean type", () => {
        expect.assertions(defaultOptions.length);

        defaultOptions.forEach((option) => {
            expect(option.type).toBe(Boolean);
        });
    });
});
