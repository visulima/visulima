import { describe, expect, it } from "vitest";

import commentsToOpenApi from "../../src/jsdoc/comments-to-open-api";

describe("code blocks", () => {
    it("keeps spacing", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /\n\
 * @description List API versions\n\
 * ```xml\n\
 * <Fun>\n\
 *   <InTheSun>😎</InTheSun>\n\
 * </Fun>\n\
 * ```\n\
 * bye\n\
 *\n\
 * @response 200 - ok\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        description:
                            "List API versions\n```xml\n<Fun>\n  <InTheSun>😎</InTheSun>\n</Fun>\n```\nbye",
                        responses: {
                            200: {
                                description: "ok",
                            },
                        },
                    },
                },
            },
        };

        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });
});

describe("commentsToOpenApi", () => {
    it("big stuff", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * POST /pet\n\
 *\n\
 * @externalDocs https://example.com - Find more info here\n\
 *\n\
 * @server https://development.gigantic-server.com/v1 - Development server\n\
 * @server https://gigantic-server.com/v1 - production server\n\
 *\n\
 * @paramComponent {ExampleParameter}\n\
 * @queryParam {ExampleSchema} [password] - username to fetch\n\
 * @queryParam {integer} [limit=20] - the limit to fetch\n\
 * @queryParam {number} [pi=3.14] - the limit to fetch\n\
 * @queryParam {string} [name=nick] - the limit to fetch\n\
 *\n\
 * @bodyDescription an optional description\n\
 * @bodyContent {string} application/json\n\
 * @bodyExample {ExampleExample} application/json.ExampleExample\n\
 * @bodyRequired\n\
 *\n\
 * @response                           200 - sup\n\
 * @responseContent   {string}         200.application/json\n\
 * @responseExample   {ExampleExample} 200.application/json.example1\n\
 * @responseExample   {ExampleExample} 200.application/json.example2\n\
 * @responseHeaderComponent {ExampleHeader}  200.some-header\n\
 * @responseHeaderComponent {ExampleHeader}  200.some-header2\n\
 * @responseLink      {ExampleLink}    200.some-link\n\
 * @responseLink      {ExampleLink}    200.some-link2\n\
 *\n\
 * @response 400 - :(\n\
 *\n\
 * @responseComponent {ExampleResponse} default\n\
 *\n\
 * @callback {ExampleCallback} onSomethin\n\
 * @callback {ExampleCallback} onSomethin2\n\
 *\n\
 * @security ExampleSecurity\n\
 * @security ExampleSecurity3\n\
 */\n\
 /**\n\
 * PUT /pet\n\
 * @deprecated\n\
 * @bodyComponent {ExampleBody}\n\
 * @response 200 - fun\n\
 *\n\
 * @security ExampleSecurity2.write:pets\n\
 * @security ExampleSecurity2.read:pets\n\
 */'.replace(/\r\n/g, "\n");

        const expected1 = {
            paths: {
                "/pet": {
                    post: {
                        externalDocs: {
                            description: "Find more info here",
                            url: "https://example.com",
                        },
                        servers: [
                            {
                                description: "Development server",
                                url: "https://development.gigantic-server.com/v1",
                            },
                            {
                                description: "production server",
                                url: "https://gigantic-server.com/v1",
                            },
                        ],
                        parameters: [
                            {
                                $ref: "#/components/parameters/ExampleParameter",
                            },
                            {
                                name: "password",
                                in: "query",
                                description: "username to fetch",
                                required: false,
                                schema: {
                                    $ref: "#/components/schemas/ExampleSchema",
                                },
                            },
                            {
                                name: "limit",
                                in: "query",
                                // eslint-disable-next-line radar/no-duplicate-string
                                description: "the limit to fetch",
                                required: false,
                                schema: {
                                    type: "integer",
                                    default: 20,
                                },
                            },
                            {
                                name: "pi",
                                in: "query",
                                description: "the limit to fetch",
                                required: false,
                                schema: {
                                    type: "number",
                                    default: 3.14,
                                },
                            },
                            {
                                name: "name",
                                in: "query",
                                description: "the limit to fetch",
                                required: false,
                                schema: {
                                    type: "string",
                                    default: "nick",
                                },
                            },
                        ],
                        requestBody: {
                            description: "an optional description",
                            required: true,
                            content: {
                                "application/json": {
                                    examples: {
                                        ExampleExample: {
                                            // eslint-disable-next-line radar/no-duplicate-string
                                            $ref: "#/components/examples/ExampleExample",
                                        },
                                    },
                                    schema: {
                                        type: "string",
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "sup",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "string",
                                        },
                                        examples: {
                                            example1: {
                                                $ref: "#/components/examples/ExampleExample",
                                            },
                                            example2: {
                                                $ref: "#/components/examples/ExampleExample",
                                            },
                                        },
                                    },
                                },
                                headers: {
                                    "some-header": {
                                        $ref: "#/components/headers/ExampleHeader",
                                    },
                                    "some-header2": {
                                        $ref: "#/components/headers/ExampleHeader",
                                    },
                                },
                                links: {
                                    "some-link": {
                                        $ref: "#/components/links/ExampleLink",
                                    },
                                    "some-link2": {
                                        $ref: "#/components/links/ExampleLink",
                                    },
                                },
                            },
                            400: {
                                description: ":(",
                            },
                            default: {
                                $ref: "#/components/responses/ExampleResponse",
                            },
                        },
                        callbacks: {
                            onSomethin: {
                                $ref: "#/components/callbacks/ExampleCallback",
                            },
                            onSomethin2: {
                                $ref: "#/components/callbacks/ExampleCallback",
                            },
                        },
                        security: [
                            {
                                ExampleSecurity: [],
                            },
                            {
                                ExampleSecurity3: [],
                            },
                        ],
                    },
                },
            },
        };

        const expected2 = {
            paths: {
                "/pet": {
                    put: {
                        deprecated: true,
                        requestBody: {
                            $ref: "#/components/requestBodies/ExampleBody",
                        },
                        responses: {
                            200: {
                                description: "fun",
                            },
                        },
                        security: [
                            {
                                ExampleSecurity2: ["write:pets", "read:pets"],
                            },
                        ],
                    },
                },
            },
        };

        const specification = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual([expected1, expected2]);
    });

    it("random properities I don't normally use", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /\n\
 * @operationId listVersionsv2\n\
 * @summary List API versions\n\
 * @response 200 - 200 response\n\
 * @response 300 - 300 response\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        operationId: "listVersionsv2",
                        summary: "List API versions",
                        responses: {
                            200: {
                                description: "200 response",
                            },
                            300: {
                                description: "300 response",
                            },
                        },
                    },
                },
            },
        };

        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("simple example", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /hello\n\
 * @description Get a "hello world" message.\n\
 * @response 200 - hello world.\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/hello": {
                    get: {
                        // eslint-disable-next-line radar/no-duplicate-string
                        description: 'Get a "hello world" message.',
                        responses: {
                            200: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                description: "hello world.",
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("2 examples", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * POST /hello\n\
 * @description Get a "hello world" message.\n\
 * @response 200 - hello world.\n\
 * @responseContent {string} 200.text/plain\n\
 */\n\
 const garbage = "trash";\n\
 // eslint-disable-next-line no-console\n\
 console.log(garbage);\n\
 /**\n\
  * GET /hello\n\
  * @description Get a "hello world" message.\n\
  * @response 200 - hello world.\n\
  * @responseContent {string} 200.text/plain\n\
  */'.replace(/\r\n/g, "\n");

        const expected1 = {
            paths: {
                "/hello": {
                    post: {
                        description: 'Get a "hello world" message.',
                        responses: {
                            200: {
                                description: "hello world.",
                                content: {
                                    "text/plain": {
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const expected2 = {
            paths: {
                "/hello": {
                    get: {
                        description: 'Get a "hello world" message.',
                        responses: {
                            200: {
                                description: "hello world.",
                                content: {
                                    "text/plain": {
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const specification = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual([expected1, expected2]);
    });

    it("complex example", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /api/v1/cars/{country}/{city}\n\
 * @description Get a list of cars at a location.\n\
 * @pathParam {string} country - Country of the rental company.\n\
 * @pathParam {string} city - City of the rental company.\n\
 * @queryParam {string} [company] - Rental Company name.\n\
 * @queryParam {string} [car] - Car Name.\n\
 * @queryParam {string} [type] - Car Type.\n\
 * @queryParam {string} [style] - Car Style.\n\
 * @queryParam {number} [mincost] - Min Cost.\n\
 * @queryParam {number} [maxcost] - Max Cost.\n\
 * @response 200 - A list of cars.\n\
 * @responseContent {string[]} 200.application/json\n\
 * @response 400 - Example Error.\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/api/v1/cars/{country}/{city}": {
                    get: {
                        description: "Get a list of cars at a location.",
                        parameters: [
                            {
                                in: "path",
                                name: "country",
                                description: "Country of the rental company.",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                in: "path",
                                name: "city",
                                description: "City of the rental company.",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                in: "query",
                                name: "company",
                                description: "Rental Company name.",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                in: "query",
                                name: "car",
                                description: "Car Name.",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                in: "query",
                                name: "type",
                                description: "Car Type.",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                in: "query",
                                name: "style",
                                description: "Car Style.",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                in: "query",
                                name: "mincost",
                                description: "Min Cost.",
                                required: false,
                                schema: {
                                    type: "number",
                                },
                            },
                            {
                                in: "query",
                                name: "maxcost",
                                description: "Max Cost.",
                                required: false,
                                schema: {
                                    type: "number",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                description: "A list of cars.",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array",
                                            items: {
                                                type: "string",
                                            },
                                        },
                                    },
                                },
                            },
                            400: {
                                description: "Example Error.",
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("simple post", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * POST /hello\n\
 * @description Post a "hello world" message.\n\
 * @bodyContent {boolean} application/json\n\
 * @bodyDescription Whether or not to say hello world.\n\
 * @response 200 - hello world.\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/hello": {
                    post: {
                        // eslint-disable-next-line radar/no-duplicate-string
                        description: 'Post a "hello world" message.',
                        requestBody: {
                            description: "Whether or not to say hello world.",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "boolean",
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "hello world.",
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("form post", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * POST /hello\n\
 * @description Post a "hello world" message.\n\
 * @bodyContent {ExampleObject} application/x-www-form-urlencoded\n\
 * @bodyDescription A more complicated object.\n\
 * @response 200 - hello world.\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/hello": {
                    post: {
                        description: 'Post a "hello world" message.',
                        requestBody: {
                            description: "A more complicated object.",
                            content: {
                                "application/x-www-form-urlencoded": {
                                    schema: {
                                        // eslint-disable-next-line radar/no-duplicate-string
                                        $ref: "#/components/schemas/ExampleObject",
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "hello world.",
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("many bodies post", () => {
        // Note: We can't use "*/*" in doc comments.
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * POST /hello\n\
 * @description Post a "hello world" message.\n\
 * @bodyContent {ExampleObject} application/x-www-form-urlencoded\n\
 * @bodyContent {ExampleObject} application/json\n\
 * @bodyContent {binary} image/png\n\
 * @bodyContent {string} */*\n\
 * @bodyDescription A more complicated object.\n\
 * @bodyRequired\n\
 * @response 200 - hello world.\n\
 * @responseContent {Car[]} 200.application/json\n\
 * @responseHeader {string} 200.x-next - A link to the next page of responses\n\
 * @responseExample {Example} 200.application/json.example1\n\
 * @responseContent {string} 400.application/json\n\
 * @responseHeader {string} 400.fake-header - A fake header\n\
 * @responseExample {Example} 400.application/json.example1\n\
 * @response 400 - error.\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/hello": {
                    post: {
                        description: 'Post a "hello world" message.',
                        requestBody: {
                            description: "A more complicated object.",
                            required: true,
                            content: {
                                "application/x-www-form-urlencoded": {
                                    schema: {
                                        $ref: "#/components/schemas/ExampleObject",
                                    },
                                },
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/ExampleObject",
                                    },
                                },
                                "image/png": {
                                    schema: {
                                        type: "string",
                                        format: "binary",
                                    },
                                },
                                "*/*": {
                                    schema: {
                                        type: "string",
                                    },
                                },
                            },
                        },
                        responses: {
                            200: {
                                description: "hello world.",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/Car",
                                            },
                                        },
                                        examples: {
                                            example1: {
                                                $ref: "#/components/examples/Example",
                                            },
                                        },
                                    },
                                },
                                headers: {
                                    "x-next": {
                                        description: "A link to the next page of responses",
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                            },
                            400: {
                                description: "error.",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "string",
                                        },
                                        examples: {
                                            example1: {
                                                $ref: "#/components/examples/Example",
                                            },
                                        },
                                    },
                                },
                                headers: {
                                    "fake-header": {
                                        description: "A fake header",
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("api-with-examples", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /\n\
 * @operationId listVersionsv2\n\
 * @summary List API versions\n\
 * @response 200 - 200 response\n\
 * @responseContent 200.application/json\n\
 * @responseExample {Foo} 200.application/json.foo\n\
 * @response 300 - 300 response\n\
 * @responseContent 300.application/json\n\
 * @responseExample {Foo} 300.application/json.foo\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        operationId: "listVersionsv2",
                        summary: "List API versions",
                        responses: {
                            200: {
                                description: "200 response",
                                content: {
                                    "application/json": {
                                        examples: {
                                            foo: {
                                                $ref: "#/components/examples/Foo",
                                            },
                                        },
                                    },
                                },
                            },
                            300: {
                                description: "300 response",
                                content: {
                                    "application/json": {
                                        examples: {
                                            foo: {
                                                $ref: "#/components/examples/Foo",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("callback", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
  * POST /streams\n\
  * @description subscribes a client to receive out-of-band data\n\
  * @queryParam {uri} callbackUrl - the location where data will be sent.  Must be network accessible\n\
  * by the source server\n\
  * @response 201 - subscription successfully created\n\
  * @responseContent {Custom} 201.application/json\n\
  * @callback {Callback} onData\n\
  */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/streams": {
                    post: {
                        description: "subscribes a client to receive out-of-band data",
                        parameters: [
                            {
                                name: "callbackUrl",
                                in: "query",
                                required: true,
                                description:
                                    "the location where data will be sent.  Must be network accessible\nby the source server",
                                schema: {
                                    $ref: "#/components/schemas/uri",
                                },
                            },
                        ],
                        responses: {
                            201: {
                                description: "subscription successfully created",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Custom",
                                        },
                                    },
                                },
                            },
                        },
                        callbacks: {
                            onData: {
                                $ref: "#/components/callbacks/Callback",
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("links", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /users/{username}\n\
 * @operationId getUserByName\n\
 * @pathParam {string} username\n\
 * @response 200 - The User\n\
 * @responseContent {User} 200.application/json\n\
 * @responseLink {UserRepositories} 200.userRepositories\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/users/{username}": {
                    get: {
                        operationId: "getUserByName",
                        parameters: [
                            {
                                name: "username",
                                in: "path",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                description: "The User",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/User",
                                        },
                                    },
                                },
                                links: {
                                    userRepositories: {
                                        $ref: "#/components/links/UserRepositories",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("petstore", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /pets\n\
 * @summary List all pets\n\
 * @operationId listPets\n\
 * @tag pets\n\
 * @queryParam {int32} [limit] - How many items to return at one time (max 100)\n\
 * @response 200 - A paged array of pets\n\
 * @responseHeader {string} 200.x-next - A link to the next page of responses\n\
 * @responseContent {Pets} 200.application/json\n\
 * @response default - unexpected error\n\
 * @responseContent {Error} default.application/json\n\
 */\n\
/**\n\
 * POST /pets\n\
 * @summary Create a pet\n\
 * @operationId createPets\n\
 * @tag pets\n\
 * @response 201 - Null response\n\
 * @response default - unexpected error\n\
 * @responseContent {Error} default.application/json\n\
 */\n\
/**\n\
 * GET /pets/{petId}\n\
 * @summary Info for a specific pet\n\
 * @operationId showPetById\n\
 * @tag pets\n\
 * @tag another tag with space\n\
 * @pathParam {string} petId - The id of the pet to retrieve\n\
 * @response 200 - Expected response to a valid request\n\
 * @responseContent {Pets} 200.application/json\n\
 * @response default - unexpected error\n\
 * @responseContent {Error} default.application/json\n\
 */'.replace(/\r\n/g, "\n");

        const expected1 = {
            paths: {
                "/pets": {
                    get: {
                        summary: "List all pets",
                        operationId: "listPets",
                        tags: ["pets"],
                        parameters: [
                            {
                                name: "limit",
                                in: "query",
                                description: "How many items to return at one time (max 100)",
                                required: false,
                                schema: {
                                    type: "integer",
                                    format: "int32",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                description: "A paged array of pets",
                                headers: {
                                    "x-next": {
                                        description: "A link to the next page of responses",
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Pets",
                                        },
                                    },
                                },
                            },
                            default: {
                                // eslint-disable-next-line radar/no-duplicate-string
                                description: "unexpected error",
                                content: {
                                    "application/json": {
                                        schema: {
                                            // eslint-disable-next-line radar/no-duplicate-string
                                            $ref: "#/components/schemas/Error",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const expected2 = {
            paths: {
                "/pets": {
                    post: {
                        summary: "Create a pet",
                        operationId: "createPets",
                        tags: ["pets"],
                        responses: {
                            201: {
                                description: "Null response",
                            },
                            default: {
                                description: "unexpected error",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Error",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const expected3 = {
            paths: {
                "/pets/{petId}": {
                    get: {
                        summary: "Info for a specific pet",
                        operationId: "showPetById",
                        tags: ["pets", "another tag with space"],
                        parameters: [
                            {
                                name: "petId",
                                in: "path",
                                required: true,
                                description: "The id of the pet to retrieve",
                                schema: {
                                    type: "string",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                description: "Expected response to a valid request",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Pets",
                                        },
                                    },
                                },
                            },
                            default: {
                                description: "unexpected error",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Error",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
        const specification = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual([expected1, expected2, expected3]);
    });

    it("multiple response content types", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * GET /\n\
 * @response 200 - OK\n\
 * @responseContent {Pet} 200.application/json\n\
 * @responseContent {Pet} 200.application/xml\n\
 */'.replace(/\r\n/g, "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        responses: {
                            200: {
                                description: "OK",
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Pet",
                                        },
                                    },
                                    "application/xml": {
                                        schema: {
                                            $ref: "#/components/schemas/Pet",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("does nothing for normal comment", () => {
        // eslint-disable-next-line no-multi-str,@typescript-eslint/quotes
        const comment = '/**\n\
 * normal comment\n\
 */'.replace(/\r\n/g, "\n");

        const specification = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toHaveLength(0);
    });
});
/* eslint-enabled no-tabs */
