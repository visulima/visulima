import { describe, expect, it } from "vitest";

import PrismaJsonSchemaParser from "../../src/swagger/json-schema-parser";
import { sampleDmmf } from "./__fixtures__/sample-dmmf";

describe("prismaJsonSchemaParser end-to-end", () => {
    it("should parse models via parseModels", () => {
        expect.assertions(2);

        const parser = new PrismaJsonSchemaParser(sampleDmmf);
        const result = parser.parseModels();

        expect(result).toHaveProperty("User");
        expect((result.User as { properties: Record<string, unknown> }).properties).toHaveProperty("email");
    });

    it("should parse input types via parseInputTypes", () => {
        expect.assertions(3);

        const parser = new PrismaJsonSchemaParser(sampleDmmf);
        const result = parser.parseInputTypes(["User"]);

        expect(result).toHaveProperty("CreateUser");
        expect(result).toHaveProperty("UpdateUser");

        const createSchema = result.CreateUser as { properties: Record<string, unknown>; required?: string[] };

        expect(createSchema.properties).toHaveProperty("email");
    });

    it("should build example schemas via getExampleModelsSchemas", () => {
        expect.assertions(3);

        const parser = new PrismaJsonSchemaParser(sampleDmmf);
        const models = parser.parseModels();
        const examples = parser.getExampleModelsSchemas(["User"], models as unknown as Record<string, never>);

        expect(examples).toHaveProperty("User");
        expect(examples).toHaveProperty("Users");
        expect(examples).toHaveProperty("UserPage");
    });
});
