import { describe, expect, it } from "vitest";

import type { BaseDefinition, OpenApiObject } from "../src/exported";
import SpecBuilder from "../src/spec-builder";

const minimalDefinition: BaseDefinition = {
    info: { title: "API", version: "1.0.0" },
    openapi: "3.0.0",
};

describe(SpecBuilder, () => {
    it("only assigns required fields when optional ones are absent", () => {
        expect.assertions(7);

        const spec = new SpecBuilder(minimalDefinition);

        expect(spec.openapi).toBe("3.0.0");
        expect(spec.info).toStrictEqual({ title: "API", version: "1.0.0" });
        expect(spec.paths).toStrictEqual({});
        expect(spec.servers).toBeUndefined();
        expect(spec.components).toBeUndefined();
        expect(spec.security).toBeUndefined();
        expect(spec.tags).toBeUndefined();
    });

    it("copies every optional field from the base definition when present", () => {
        expect.assertions(6);

        const definition: BaseDefinition = {
            components: { schemas: { Pet: { type: "object" } } },
            externalDocs: { url: "https://example.com/docs" },
            info: { title: "Full API", version: "2.0.0" },
            openapi: "3.0.0",
            paths: { "/pets": { get: { responses: { 200: { description: "ok" } } } } },
            security: [{ apiKey: [] }],
            servers: [{ url: "https://example.com" }],
            tags: [{ name: "pets" }],
        };

        const spec = new SpecBuilder(definition);

        expect(spec.servers).toStrictEqual([{ url: "https://example.com" }]);
        expect(spec.components).toStrictEqual({ schemas: { Pet: { type: "object" } } });
        expect(spec.security).toStrictEqual([{ apiKey: [] }]);
        expect(spec.tags).toStrictEqual([{ name: "pets" }]);
        expect(spec.externalDocs).toStrictEqual({ url: "https://example.com/docs" });
        expect(spec.paths).toStrictEqual({ "/pets": { get: { responses: { 200: { description: "ok" } } } } });
    });

    it("merges paths and components and overwrites the remaining fields via addData", () => {
        expect.assertions(3);

        const spec = new SpecBuilder(minimalDefinition);

        const parsed: OpenApiObject[] = [
            {
                components: { schemas: { Pet: { type: "object" } } },
                info: { title: "Overwritten", version: "9.9.9" },
                openapi: "3.0.0",
                paths: { "/pets": { get: { responses: { 200: { description: "list" } } } } },
            },
            {
                paths: { "/store": { get: { responses: { 200: { description: "store" } } } } },
            } as OpenApiObject,
        ];

        spec.addData(parsed);

        expect(spec.paths).toStrictEqual({
            "/pets": { get: { responses: { 200: { description: "list" } } } },
            "/store": { get: { responses: { 200: { description: "store" } } } },
        });
        expect(spec.components).toStrictEqual({ schemas: { Pet: { type: "object" } } });
        // `info` from the "rest" branch overwrites the base definition value.
        expect(spec.info).toStrictEqual({ title: "Overwritten", version: "9.9.9" });
    });

    it("defaults missing paths/components to empty objects in addData", () => {
        expect.assertions(2);

        const spec = new SpecBuilder(minimalDefinition);

        spec.addData([{ openapi: "3.0.0" } as OpenApiObject]);

        expect(spec.paths).toStrictEqual({});
        expect(spec.components).toStrictEqual({});
    });
});
