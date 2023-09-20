import { describe, expect, it } from "vitest";
import generateCode from "../../../../src/generator/util/generate-code";
import deepInternal from "../../../../__fixtures__/deep-internal/bundled";

const fixtureDirectory = `${__dirname}/../../../../__fixtures__`;
describe("generateCode", () => {
    it("should successfully parse and merge OpenAPI specs from multiple files", async () => {
        const foundFiles = [`${fixtureDirectory}/petstore.yml`, `${fixtureDirectory}/swagger.json`];
        const swaggerDefinition = {};
        const verbose = true;
        const stopOnInvalid = false;

        // Call the generateCode function
        const result = await generateCode(foundFiles, swaggerDefinition, verbose, stopOnInvalid);

        expect(result).toMatchSnapshot();
    });

    it("should successfully parse short and long jsdoc with mutiple files", async () => {
        const foundFiles = [
            `${fixtureDirectory}/project/swagger.json`,
            `${fixtureDirectory}/project/routes/user.js`,
            `${fixtureDirectory}/project/routes/store.js`,
            `${fixtureDirectory}/project/routes/pet.js`,
            `${fixtureDirectory}/project/routes/components/pet-schema.yml`,
            `${fixtureDirectory}/project/routes/components/user-schema.yml`,
            `${fixtureDirectory}/project/routes/components/store-schema.yml`,
            `${fixtureDirectory}/project/routes/components/security.yaml`,
        ];
        const swaggerDefinition = {};
        const verbose = true;
        const stopOnInvalid = false;

        // Call the generateCode function
        const result = await generateCode(foundFiles, swaggerDefinition, verbose, stopOnInvalid);

        expect(result).toMatchSnapshot();
    });

    it("should bundle successfully Schema with deeply-nested internal $refs", async () => {
        const swaggerDefinition = {};
        const verbose = true;
        const stopOnInvalid = false;

        // Call the generateCode function
        const result = await generateCode([`${fixtureDirectory}/deep-internal/Full-spec.yaml`], swaggerDefinition, verbose, stopOnInvalid);

        expect(result).toEqual(deepInternal);
    });
});
