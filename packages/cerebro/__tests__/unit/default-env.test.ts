import { describe, expect, expectTypeOf, it } from "vitest";

import defaultEnv from "../../src/default-env";

describe("default-env", () => {
    it("should export an array of environment variable definitions", () => {
        expect.assertions(2);

        expect(Array.isArray(defaultEnv)).toBe(true);
        expect(defaultEnv.length).toBeGreaterThan(0);
    });

    it("should have all required properties for each env definition", () => {
        expect.assertions(defaultEnv.length);

        for (const envDefinition of defaultEnv) {
            expect(envDefinition).toHaveProperty("name");

            expectTypeOf(envDefinition.name).toBeString();
        }
    });

    it("should include CEREBRO_OUTPUT_LEVEL environment variable", () => {
        expect.assertions(3);

        const cerebroOutputLevel = defaultEnv.find((env) => env.name === "CEREBRO_OUTPUT_LEVEL");

        expect(cerebroOutputLevel).toBeDefined();
        expect(cerebroOutputLevel?.type).toBe(String);
        expect(cerebroOutputLevel?.defaultValue).toBe("32");
    });

    it("should include CEREBRO_MIN_NODE_VERSION environment variable", () => {
        expect.assertions(2);

        const minNodeVersion = defaultEnv.find((env) => env.name === "CEREBRO_MIN_NODE_VERSION");

        expect(minNodeVersion).toBeDefined();
        expect(minNodeVersion?.type).toBe(Number);
    });

    it("should include NO_UPDATE_NOTIFIER environment variable", () => {
        expect.assertions(3);

        const noUpdateNotifier = defaultEnv.find((env) => env.name === "NO_UPDATE_NOTIFIER");

        expect(noUpdateNotifier).toBeDefined();
        expect(noUpdateNotifier?.type).toBe(Boolean);
        expect(noUpdateNotifier?.defaultValue).toBe(false);
    });

    it("should include NODE_ENV environment variable", () => {
        expect.assertions(2);

        const nodeEnv = defaultEnv.find((env) => env.name === "NODE_ENV");

        expect(nodeEnv).toBeDefined();
        expect(nodeEnv?.type).toBe(String);
    });

    it("should include DEBUG environment variable", () => {
        expect.assertions(3);

        const debug = defaultEnv.find((env) => env.name === "DEBUG");

        expect(debug).toBeDefined();
        expect(debug?.type).toBe(Boolean);
        expect(debug?.defaultValue).toBe(false);
    });

    it("should have valid type definitions", () => {
        expect.assertions(defaultEnv.length);

        const validTypes = [String, Number, Boolean];

        for (const envDefinition of defaultEnv) {
            if (envDefinition.type) {
                expect(validTypes).toContain(envDefinition.type);
            }
        }
    });

    it("should have descriptions for all environment variables", () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(defaultEnv.length * 2);

        for (const envDefinition of defaultEnv) {
            expect(envDefinition.description).toBeDefined();

            expectTypeOf(envDefinition.description).toBeString();

            expect(envDefinition.description?.length).toBeGreaterThan(0);
        }
    });
});
