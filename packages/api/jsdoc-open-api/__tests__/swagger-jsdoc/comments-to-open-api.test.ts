import { describe, expect, it } from "vitest";

import commentsToOpenApi from "../../src/swagger-jsdoc/comments-to-open-api";

describe(commentsToOpenApi, () => {
    it("simple openapi", () => {
        expect.assertions(1);

        const fileContents = `
/**
 * @openapi
 * /pets:
 *   get:
 *     description: Returns all pets from the system that the user has access to
 *     responses:
 *       '200':
 *         description: A list of pets.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pet'
 *   post:
 *     description: Creates a new pet in the store.  Duplicates are allowed
 *     responses:
 *       '200':
 *         description: Pet response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pet'
 */
`;

        const result = commentsToOpenApi(fileContents);

        expect(result).toStrictEqual([
            {
                loc: 2,
                spec: {
                    paths: {
                        "/pets": {
                            get: {
                                description: "Returns all pets from the system that the user has access to",
                                responses: {
                                    200: {
                                        content: {
                                            "application/json": {
                                                schema: {
                                                    items: {
                                                        $ref: "#/components/schemas/Pet",
                                                    },
                                                    type: "array",
                                                },
                                            },
                                        },
                                        description: "A list of pets.",
                                    },
                                },
                            },
                            post: {
                                description: "Creates a new pet in the store.  Duplicates are allowed",
                                responses: {
                                    200: {
                                        content: {
                                            "application/json": {
                                                schema: {
                                                    $ref: "#/components/schemas/Pet",
                                                },
                                            },
                                        },
                                        description: "Pet response",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        ]);
    });

    it("simple asyncapi", () => {
        expect.assertions(1);

        const fileContents = `
/**
 * @asyncapi
 * channels:
 *   /user/signedup:
 *    description: This channel is used to exchange messages about users signing up
 *    subscribe:
 *      summary: A user signed up.
 *      message:
 *        description: A longer description of the message
 *        payload:
 *         type: object
 *         properties:
 *          user:
 *           type: object
 *           required:
 *            - name
 *           properties:
 *            name:
 *             type: string
 *            age:
 *             type: integer
 *             format: int32
 *             minimum: 0
 * components:
 *   schemas:
 *     user:
 *       type: object
 *       required:
 *       - name
 *       properties:
 *         name:
 *           type: string
 *         age:
 *           type: integer
 *           format: int32
 *           minimum: 0
 */`;

        const result = commentsToOpenApi(fileContents);

        expect(result).toStrictEqual([
            {
                loc: 2,
                spec: {
                    channels: {
                        "/user/signedup": {
                            description: "This channel is used to exchange messages about users signing up",
                            subscribe: {
                                message: {
                                    description: "A longer description of the message",
                                    payload: {
                                        properties: {
                                            user: {
                                                properties: {
                                                    age: {
                                                        format: "int32",
                                                        minimum: 0,
                                                        type: "integer",
                                                    },
                                                    name: {
                                                        type: "string",
                                                    },
                                                },
                                                required: ["name"],
                                                type: "object",
                                            },
                                        },
                                        type: "object",
                                    },
                                },
                                summary: "A user signed up.",
                            },
                        },
                    },
                    components: {
                        schemas: {
                            user: {
                                properties: {
                                    age: {
                                        format: "int32",
                                        minimum: 0,
                                        type: "integer",
                                    },
                                    name: {
                                        type: "string",
                                    },
                                },
                                required: ["name"],
                                type: "object",
                            },
                        },
                    },
                },
            },
        ]);
    });

    it("openapi with Square Bracket", () => {
        expect.assertions(1);

        const fileContents = `
    /**
     * Description
     *
     * @private
     * @async
     * @param {Request} [request]
     * @param {JSONResponse} [response]
     * @memberof SftpgoController
     * @swagger
     * /v1/getToken:
     *  get:
     *   security: []
     *   tags:
     *    - getToken
     *   responses:
     *    '200':
     *     description: successful operation
     *     content:
     *      application/json:
     *       schema:
     *        type: object
     *        properties:
     *         success:
     *          type: boolean
     *         data:
     *          type: object
     *          items:
     *            properties:
     *             access_token:
     *              type: string
     *              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
     *             expires_at:
     *              type: string
     *              example: '2022-09-04T06:17:59Z'
     *             current_time:
     *              type: string
     *              example: '2022-09-04T06:17:59Z'
     */
 `;
        const result = commentsToOpenApi(fileContents);

        expect(result).toStrictEqual([
            {
                loc: 7,
                spec: {
                    paths: {
                        "/v1/getToken": {
                            get: {
                                responses: {
                                    200: {
                                        content: {
                                            "application/json": {
                                                schema: {
                                                    properties: {
                                                        data: {
                                                            items: {
                                                                properties: {
                                                                    access_token: {

                                                                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                                                        type: "string",
                                                                    },
                                                                    current_time: {
                                                                        example: "2022-09-04T06:17:59Z",
                                                                        type: "string",
                                                                    },
                                                                    expires_at: {
                                                                        example: "2022-09-04T06:17:59Z",
                                                                        type: "string",
                                                                    },
                                                                },
                                                            },
                                                            type: "object",
                                                        },
                                                        success: {
                                                            type: "boolean",
                                                        },
                                                    },
                                                    type: "object",
                                                },
                                            },
                                        },
                                        description: "successful operation",
                                    },
                                },
                                security: [],
                                tags: ["getToken"],
                            },
                        },
                    },
                },
            },
        ]);
    });

    it("openapi with formData", () => {
        expect.assertions(1);

        const fileContents = `
/**
 * @swagger
 * /accessories-centers:
 *   post:
 *     tags:
 *       - Accessories-Centers
 *     consumes:
 *       - "multipart/form-data"
 *     summary: Create a new Accessories center
 *     parameters:
 *           - name: "mainSpecialities[]"
 *             in: "formData"
 *             description: "Ids Main Specialities Of accessories center"
 *             required: false
 *             collectionFormat: multi
 *             type: array
 *             items:
 *                  type: string
 *     responses:
 *       201:
 *         description: Returns Created accessories-Center
 */
`;
        const result = commentsToOpenApi(fileContents);

        expect(result).toStrictEqual([
            {
                loc: 2,
                spec: {
                    paths: {
                        "/accessories-centers": {
                            post: {
                                consumes: ["multipart/form-data"],
                                parameters: [
                                    {
                                        collectionFormat: "multi",
                                        description: "Ids Main Specialities Of accessories center",
                                        in: "formData",
                                        items: {
                                            type: "string",
                                        },
                                        name: "mainSpecialities[]",
                                        required: false,
                                        type: "array",
                                    },
                                ],
                                responses: {
                                    201: {
                                        description: "Returns Created accessories-Center",
                                    },
                                },
                                summary: "Create a new Accessories center",
                                tags: ["Accessories-Centers"],
                            },
                        },
                    },
                },
            },
        ]);
    });

    it("combines an inline top-level property name (ending with \":\") with its description", () => {
        expect.assertions(1);

        // The tag name (`tags:`) is on the same line as `@openapi`, so it ends up in the
        // `name` token and is combined with the following description block.
        const fileContents = `
/**
 * @openapi tags:
 *   - name: pets
 *     description: Everything about pets
 */
`;

        const result = commentsToOpenApi(fileContents);

        expect(result).toStrictEqual([
            {
                loc: 2,
                spec: {
                    paths: {},
                    tags: [{ description: "Everything about pets", name: "pets" }],
                },
            },
        ]);
    });

    it("combines an inline path name (starting with \"/\") with its description", () => {
        expect.assertions(1);

        // The path is inline with `@openapi`, so `name` starts with "/" and is prepended
        // to the YAML description body.
        const fileContents = `
/**
 * @openapi /pets:
 *   get:
 *     responses:
 *       200:
 *         description: ok
 */
`;

        const result = commentsToOpenApi(fileContents);

        expect(result).toStrictEqual([
            {
                loc: 2,
                spec: {
                    paths: {
                        "/pets": {
                            get: {
                                responses: {
                                    200: { description: "ok" },
                                },
                            },
                        },
                    },
                },
            },
        ]);
    });

    it("uses just the inline name when there is no description body", () => {
        expect.assertions(1);

        // `@openapi /pets:` with no following body — the trimmed description is empty, so the
        // bare name is used as the YAML content.
        const fileContents = `
/**
 * @openapi /pets:
 */
`;

        const result = commentsToOpenApi(fileContents);

        expect(result).toStrictEqual([
            {
                loc: 2,
                spec: {
                    paths: { "/pets": {} },
                },
            },
        ]);
    });

    it("throws a non-verbose error when the YAML cannot be parsed", () => {
        expect.assertions(2);

        const fileContents = `
/**
 * @openapi
 * /pets:
 *   get:
 *  bad: indentation: here
 */
`;

        expect(() => commentsToOpenApi(fileContents)).toThrow("Error parsing YAML in @openapi spec:");
        expect(() => commentsToOpenApi(fileContents)).not.toThrow("Imbedded within:");
    });

    it("throws a verbose error that embeds the offending YAML when verbose is enabled", () => {
        expect.assertions(1);

        const fileContents = `
/**
 * @openapi
 * /pets:
 *   get:
 *  bad: indentation: here
 */
`;

        expect(() => commentsToOpenApi(fileContents, true)).toThrow("Imbedded within:");
    });

    it("skips ordinary code comments that carry no @openapi/@swagger/@asyncapi tag", () => {
        expect.assertions(1);

        const fileContents = `
/**
 * A normal function doc.
 * @param {string} name
 * @returns {void}
 */
function greet(name) {}
`;

        // Previously these emitted empty \`{ loc, spec: {} }\` entries; now they are filtered out.
        expect(commentsToOpenApi(fileContents)).toStrictEqual([]);
    });

    it("only processes the comment blocks that contain a swagger tag", () => {
        expect.assertions(1);

        const fileContents = `
/**
 * Just a regular comment.
 * @param {number} id
 */
const ignored = true;

/**
 * @swagger
 * /ping:
 *   get:
 *     responses:
 *       '200':
 *         description: pong
 */
`;

        const result = commentsToOpenApi(fileContents);

        expect(result).toHaveLength(1);
    });
});
