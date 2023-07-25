import { describe, expect, it } from "vitest";

import validate from "../src/validate";

describe("validate", () => {
    it("should validate a valid spec and return no errors", async () => {
        const spec = {
            info: {
                contact: {
                    name: "API Support",
                },
                description: "test",
                title: "Valid Spec",
                version: "1.0.0",
            },
            openapi: "3.0.0",
            paths: {},
            servers: [
                {
                    url: "https://api.example.com/v1",
                },
            ],
        };

        await expect(async () => await validate(spec)).rejects.not.toThrow();
    });

    it("should throw an error if unrecognized format is detected", async () => {
        const spec = {
            customProperty: "value", // A property with unrecognized format
            info: {
                title: "Spec with unrecognized format",
            },
            openapi: "3.0.0",
            paths: {},
        };

        await expect(validate(spec)).rejects.toThrow("test");
    });
});
