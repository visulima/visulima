import { describe, expect, it } from "vitest";

import commentsToOpenApi from "../../src/jsdoc/comments-to-open-api";

describe("code blocks", () => {
    it("keeps spacing", () => {
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
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
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        description: "List API versions\n```xml\n<Fun>\n  <InTheSun>😎</InTheSun>\n</Fun>\n```\nbye",
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

describe(commentsToOpenApi, () => {
    it("big stuff", () => {
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
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
 */".replaceAll("\r\n", "\n");

        const expected1 = {
            paths: {
                "/pet": {
                    post: {
                        callbacks: {
                            onSomethin: {
                                $ref: "#/components/callbacks/ExampleCallback",
                            },
                            onSomethin2: {
                                $ref: "#/components/callbacks/ExampleCallback",
                            },
                        },
                        externalDocs: {
                            description: "Find more info here",
                            url: "https://example.com",
                        },
                        parameters: [
                            {
                                $ref: "#/components/parameters/ExampleParameter",
                            },
                            {
                                description: "username to fetch",
                                in: "query",
                                name: "password",
                                required: false,
                                schema: {
                                    $ref: "#/components/schemas/ExampleSchema",
                                },
                            },
                            {
                                description: "the limit to fetch",
                                in: "query",
                                name: "limit",
                                required: false,
                                schema: {
                                    default: 20,
                                    type: "integer",
                                },
                            },
                            {
                                description: "the limit to fetch",
                                in: "query",
                                name: "pi",
                                required: false,
                                schema: {
                                    default: 3.14,
                                    type: "number",
                                },
                            },
                            {
                                description: "the limit to fetch",
                                in: "query",
                                name: "name",
                                required: false,
                                schema: {
                                    default: "nick",
                                    type: "string",
                                },
                            },
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    examples: {
                                        ExampleExample: {
                                            $ref: "#/components/examples/ExampleExample",
                                        },
                                    },
                                    schema: {
                                        type: "string",
                                    },
                                },
                            },
                            description: "an optional description",
                            required: true,
                        },
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            example1: {
                                                $ref: "#/components/examples/ExampleExample",
                                            },
                                            example2: {
                                                $ref: "#/components/examples/ExampleExample",
                                            },
                                        },
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                                description: "sup",
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
                        security: [
                            {
                                ExampleSecurity: [],
                            },
                            {
                                ExampleSecurity3: [],
                            },
                        ],
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * GET /\n\
 * @operationId listVersionsv2\n\
 * @summary List API versions\n\
 * @response 200 - 200 response\n\
 * @response 300 - 300 response\n\
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        operationId: "listVersionsv2",
                        responses: {
                            200: {
                                description: "200 response",
                            },
                            300: {
                                description: "300 response",
                            },
                        },
                        summary: "List API versions",
                    },
                },
            },
        };

        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("simple example", () => {
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * GET /hello\n\
 * @description Get a \"hello world\" message.\n\
 * @response 200 - hello world.\n\
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/hello": {
                    get: {
                        description: "Get a \"hello world\" message.",
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

    it("2 examples", () => {
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * POST /hello\n\
 * @description Get a \"hello world\" message.\n\
 * @response 200 - hello world.\n\
 * @responseContent {string} 200.text/plain\n\
 */\n\
 const garbage = \"trash\";\n\
 // eslint-disable-next-line no-console\n\
 console.log(garbage);\n\
 /**\n\
  * GET /hello\n\
  * @description Get a \"hello world\" message.\n\
  * @response 200 - hello world.\n\
  * @responseContent {string} 200.text/plain\n\
  */".replaceAll("\r\n", "\n");

        const expected1 = {
            paths: {
                "/hello": {
                    post: {
                        description: "Get a \"hello world\" message.",
                        responses: {
                            200: {
                                content: {
                                    "text/plain": {
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                                description: "hello world.",
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
                        description: "Get a \"hello world\" message.",
                        responses: {
                            200: {
                                content: {
                                    "text/plain": {
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                                description: "hello world.",
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
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
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/api/v1/cars/{country}/{city}": {
                    get: {
                        description: "Get a list of cars at a location.",
                        parameters: [
                            {
                                description: "Country of the rental company.",
                                in: "path",
                                name: "country",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                description: "City of the rental company.",
                                in: "path",
                                name: "city",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                description: "Rental Company name.",
                                in: "query",
                                name: "company",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                description: "Car Name.",
                                in: "query",
                                name: "car",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                description: "Car Type.",
                                in: "query",
                                name: "type",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                description: "Car Style.",
                                in: "query",
                                name: "style",
                                required: false,
                                schema: {
                                    type: "string",
                                },
                            },
                            {
                                description: "Min Cost.",
                                in: "query",
                                name: "mincost",
                                required: false,
                                schema: {
                                    type: "number",
                                },
                            },
                            {
                                description: "Max Cost.",
                                in: "query",
                                name: "maxcost",
                                required: false,
                                schema: {
                                    type: "number",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            items: {
                                                type: "string",
                                            },
                                            type: "array",
                                        },
                                    },
                                },
                                description: "A list of cars.",
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * POST /hello\n\
 * @description Post a \"hello world\" message.\n\
 * @bodyContent {boolean} application/json\n\
 * @bodyDescription Whether or not to say hello world.\n\
 * @response 200 - hello world.\n\
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/hello": {
                    post: {
                        description: "Post a \"hello world\" message.",
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "boolean",
                                    },
                                },
                            },
                            description: "Whether or not to say hello world.",
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * POST /hello\n\
 * @description Post a \"hello world\" message.\n\
 * @bodyContent {ExampleObject} application/x-www-form-urlencoded\n\
 * @bodyDescription A more complicated object.\n\
 * @response 200 - hello world.\n\
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/hello": {
                    post: {
                        description: "Post a \"hello world\" message.",
                        requestBody: {
                            content: {
                                "application/x-www-form-urlencoded": {
                                    schema: {
                                        $ref: "#/components/schemas/ExampleObject",
                                    },
                                },
                            },
                            description: "A more complicated object.",
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
        expect.assertions(1);

        // Note: We can't use "*/*" in doc comments.
        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * POST /hello\n\
 * @description Post a \"hello world\" message.\n\
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
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/hello": {
                    post: {
                        description: "Post a \"hello world\" message.",
                        requestBody: {
                            content: {
                                "*/*": {
                                    schema: {
                                        type: "string",
                                    },
                                },
                                "application/json": {
                                    schema: {
                                        $ref: "#/components/schemas/ExampleObject",
                                    },
                                },
                                "application/x-www-form-urlencoded": {
                                    schema: {
                                        $ref: "#/components/schemas/ExampleObject",
                                    },
                                },
                                "image/png": {
                                    schema: {
                                        format: "binary",
                                        type: "string",
                                    },
                                },
                            },
                            description: "A more complicated object.",
                            required: true,
                        },
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            example1: {
                                                $ref: "#/components/examples/Example",
                                            },
                                        },
                                        schema: {
                                            items: {
                                                $ref: "#/components/schemas/Car",
                                            },
                                            type: "array",
                                        },
                                    },
                                },
                                description: "hello world.",
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
                                content: {
                                    "application/json": {
                                        examples: {
                                            example1: {
                                                $ref: "#/components/examples/Example",
                                            },
                                        },
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                                description: "error.",
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * GET /\n\
 * @operationId listVersionsv2\n\
 * @summary List API versions\n\
 * @response 200 - 200 response\n\
 * @responseContent 200.application/json\n\
 * @responseExample {Foo} 200.application/json.foo\n\
 * @response 300 - 300 response\n\
 * @responseContent 300.application/json\n\
 * @responseExample {Foo} 300.application/json.foo\n\
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        operationId: "listVersionsv2",
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            foo: {
                                                $ref: "#/components/examples/Foo",
                                            },
                                        },
                                    },
                                },
                                description: "200 response",
                            },
                            300: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            foo: {
                                                $ref: "#/components/examples/Foo",
                                            },
                                        },
                                    },
                                },
                                description: "300 response",
                            },
                        },
                        summary: "List API versions",
                    },
                },
            },
        };
        const [specification] = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual(expected);
    });

    it("callback", () => {
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
  * POST /streams\n\
  * @description subscribes a client to receive out-of-band data\n\
  * @queryParam {uri} callbackUrl - the location where data will be sent.  Must be network accessible\n\
  * by the source server\n\
  * @response 201 - subscription successfully created\n\
  * @responseContent {Custom} 201.application/json\n\
  * @callback {Callback} onData\n\
  */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/streams": {
                    post: {
                        callbacks: {
                            onData: {
                                $ref: "#/components/callbacks/Callback",
                            },
                        },
                        description: "subscribes a client to receive out-of-band data",
                        parameters: [
                            {
                                description: "the location where data will be sent.  Must be network accessible\nby the source server",
                                in: "query",
                                name: "callbackUrl",
                                required: true,
                                schema: {
                                    $ref: "#/components/schemas/uri",
                                },
                            },
                        ],
                        responses: {
                            201: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Custom",
                                        },
                                    },
                                },
                                description: "subscription successfully created",
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * GET /users/{username}\n\
 * @operationId getUserByName\n\
 * @pathParam {string} username\n\
 * @response 200 - The User\n\
 * @responseContent {User} 200.application/json\n\
 * @responseLink {UserRepositories} 200.userRepositories\n\
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/users/{username}": {
                    get: {
                        operationId: "getUserByName",
                        parameters: [
                            {
                                in: "path",
                                name: "username",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/User",
                                        },
                                    },
                                },
                                description: "The User",
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
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
 */".replaceAll("\r\n", "\n");

        const expected1 = {
            paths: {
                "/pets": {
                    get: {
                        operationId: "listPets",
                        parameters: [
                            {
                                description: "How many items to return at one time (max 100)",
                                in: "query",
                                name: "limit",
                                required: false,
                                schema: {
                                    format: "int32",
                                    type: "integer",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Pets",
                                        },
                                    },
                                },
                                description: "A paged array of pets",
                                headers: {
                                    "x-next": {
                                        description: "A link to the next page of responses",
                                        schema: {
                                            type: "string",
                                        },
                                    },
                                },
                            },
                            default: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Error",
                                        },
                                    },
                                },
                                description: "unexpected error",
                            },
                        },
                        summary: "List all pets",
                        tags: ["pets"],
                    },
                },
            },
        };

        const expected2 = {
            paths: {
                "/pets": {
                    post: {
                        operationId: "createPets",
                        responses: {
                            201: {
                                description: "Null response",
                            },
                            default: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Error",
                                        },
                                    },
                                },
                                description: "unexpected error",
                            },
                        },
                        summary: "Create a pet",
                        tags: ["pets"],
                    },
                },
            },
        };

        const expected3 = {
            paths: {
                "/pets/{petId}": {
                    get: {
                        operationId: "showPetById",
                        parameters: [
                            {
                                description: "The id of the pet to retrieve",
                                in: "path",
                                name: "petId",
                                required: true,
                                schema: {
                                    type: "string",
                                },
                            },
                        ],
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Pets",
                                        },
                                    },
                                },
                                description: "Expected response to a valid request",
                            },
                            default: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Error",
                                        },
                                    },
                                },
                                description: "unexpected error",
                            },
                        },
                        summary: "Info for a specific pet",
                        tags: ["pets", "another tag with space"],
                    },
                },
            },
        };
        const specification = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toStrictEqual([expected1, expected2, expected3]);
    });

    it("multiple response content types", () => {
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * GET /\n\
 * @response 200 - OK\n\
 * @responseContent {Pet} 200.application/json\n\
 * @responseContent {Pet} 200.application/xml\n\
 */".replaceAll("\r\n", "\n");

        const expected = {
            paths: {
                "/": {
                    get: {
                        responses: {
                            200: {
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
                                description: "OK",
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
        expect.assertions(1);

        // eslint-disable-next-line no-multi-str,no-use-extend-native/no-use-extend-native
        const comment = "/**\n\
 * normal comment\n\
 */".replaceAll("\r\n", "\n");

        const specification = commentsToOpenApi(comment).map((index) => index.spec);

        expect(specification).toHaveLength(0);
    });
});
/* eslint-enabled no-tabs */
