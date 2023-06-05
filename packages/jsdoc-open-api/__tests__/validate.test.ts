import { describe, expect, it } from "vitest";

import validate from "../src/validate";

describe("validate", () => {
    it("should validate a valid spec and return no errors", async () => {
        const spec = {
            info: {
                title: "Valid Spec",
                version: "1.0.0",
                description: "test",
                contact: {
                    name: "API Support",
                },
            },
            openapi: "3.0.0",
            servers: [
                {
                    url: "https://api.example.com/v1",
                },
            ],
            paths: {},
        };

        const results = await validate(spec);

        expect(results).toHaveLength(0);
    });

    it("should throw an error if unrecognized format is detected", async () => {
        const spec = {
            info: {
                title: "Spec with unrecognized format",
            },
            openapi: "3.0.0",
            paths: {},
            customProperty: "value", // A property with unrecognized format
        };

        await expect(validate(spec)).rejects.toThrowError(/Could not validate OpenAPI Specification/);
    });
});
