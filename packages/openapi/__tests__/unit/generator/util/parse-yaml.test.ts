import { describe, expect, it } from "vitest";

import parseYaml from "../../../../src/generator/util/parse-yaml";

describe("parseYaml", () => {
    it("should parse a valid OpenAPI specification and return an object containing the parsed specification and its location", () => {
        const yamlString = `
        openapi: 3.0.0
        info:
          title: Test API
          version: 1.0.0
        paths:
          /users:
            get:
              summary: Get all users
              responses:
                '200':
                  description: OK
      `;
        const expected = {
            loc: 11,
            spec: {
                info: {
                    title: "Test API",
                    version: "1.0.0",
                },
                openapi: "3.0.0",
                paths: {
                    "/users": {
                        get: {
                            responses: {
                                "200": {
                                    description: "OK",
                                },
                            },
                            summary: "Get all users",
                        },
                    },
                },
            },
        };
        const result = parseYaml(yamlString);

        expect(result).toStrictEqual(expected);
    });

    it("should return an object containing only the allowed parsed specification and its location if there are unexpected keys in the specification", () => {
        const yamlString = `
        openapi: 3.0.0
        info:
          title: Test API
          version: 1.0.0
        paths:
          /users:
            get:
              summary: Get all users
              responses:
                '200':
                  description: OK
        unexpectedKey: value
      `;
        const expected = {
            loc: 11,
            spec: {
                info: {
                    title: "Test API",
                    version: "1.0.0",
                },
                openapi: "3.0.0",
                paths: {
                    "/users": {
                        get: {
                            responses: {
                                "200": {
                                    description: "OK",
                                },
                            },
                            summary: "Get all users",
                        },
                    },
                },
            },
        };
        expect(parseYaml(yamlString)).toStrictEqual(expected);
    });

    it("should return undefined if the specification is an empty object", () => {
        const yamlString = "{}";

        const result = parseYaml(yamlString);

        expect(result).toBeUndefined();
    });

    it("should return undefined if the specification does not contain any of the ALLOWED_KEYS", () => {
        const yamlString = `
        title: Test API
        version: 1.0.0
      `;

        const result = parseYaml(yamlString);

        expect(result).toBeUndefined();
    });
});
