import type { Spec } from "comment-parser";
import { parse as parseComments } from "comment-parser";
// eslint-disable-next-line no-restricted-imports
import mergeWith from "lodash.mergewith";

import type { OpenApiObject, PathsObject } from "../exported";
import customizer from "../util/customizer";

// The security object has a bizare setup...
const fixSecurityObject = (thing: any) => {
    if (thing.security) {
        // eslint-disable-next-line no-param-reassign
        thing.security = Object.keys(thing.security).map((s) => {
            return {
                [s]: thing.security[s],
            };
        });
    }
};

const primitiveTypes = new Set(["integer", "number", "string", "boolean", "object", "array"]);

const formatMap: Record<string, string> = {
    binary: "string",
    byte: "string",
    date: "string",
    "date-time": "string",
    double: "number",
    float: "number",
    int32: "integer",
    int64: "integer",
    password: "string",
};

const parseDescription = (tag: Spec): { description: string | undefined; name: string; rawType: string; required: boolean; schema: object | undefined } => {
    const rawType = tag.type;
    const isArray = rawType.endsWith("[]");
    // eslint-disable-next-line regexp/strict
    const parsedType = rawType.replace(/\[]$/, "");

    const isPrimitive = primitiveTypes.has(parsedType);
    const isFormat = Object.keys(formatMap).includes(parsedType);

    let defaultValue;

    if (tag.default) {
        switch (parsedType) {
            case "integer":
            case "int32":
            case "int64": {
                defaultValue = Number.parseInt(tag.default, 10);
                break;
            }
            case "number":
            case "double":
            case "float": {
                defaultValue = Number.parseFloat(tag.default);
                break;
            }
            default: {
                defaultValue = tag.default;
                break;
            }
        }
    }

    let rootType;

    if (isPrimitive) {
        rootType = { default: defaultValue, type: parsedType };
    } else if (isFormat) {
        rootType = {
            default: defaultValue,
            format: parsedType,
            type: formatMap[parsedType],
        };
    } else {
        rootType = { $ref: `#/components/schemas/${parsedType as string}` };
    }

    let schema: object | undefined = isArray
        ? {
              items: {
                  ...rootType,
              },
              type: "array",
          }
        : {
              ...rootType,
          };

    if (parsedType === "") {
        schema = undefined;
    }

    // remove the optional dash from the description.
    let description: string | undefined = tag.description.trim().replace(/^- /u, "");

    if (description === "") {
        description = undefined;
    }

    return {
        description,
        name: tag.name,
        rawType,
        required: !tag.optional,
        schema,
    };
};

// @ts-expect-error
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const tagsToObjects = (tags: Spec[], verbose?: boolean) =>
    tags.map((tag) => {
        const parsedResponse = parseDescription(tag);

        // Some ops only have a `description`, merge `name` and `description`
        // for these.
        let nameAndDescription = "";

        if (parsedResponse.name) {
            nameAndDescription += parsedResponse.name;
        }

        if (parsedResponse.description) {
            nameAndDescription += ` ${parsedResponse.description.trim()}`;
        }

        switch (tag.tag) {
            case "operationId":
            case "summary":
            case "description": {
                return { [tag.tag]: nameAndDescription };
            }

            case "deprecated": {
                return { deprecated: true };
            }

            case "externalDocs": {
                return {
                    externalDocs: {
                        description: parsedResponse.description,
                        url: parsedResponse.name,
                    },
                };
            }

            case "server": {
                return {
                    servers: [
                        {
                            description: parsedResponse.description,
                            url: parsedResponse.name,
                        },
                    ],
                };
            }

            case "tag": {
                return { tags: [nameAndDescription] };
            }

            case "cookieParam":
            case "headerParam":
            case "queryParam":
            case "pathParam": {
                return {
                    parameters: [
                        {
                            description: parsedResponse.description,
                            in: tag.tag.replace(/Param$/u, ""),
                            name: parsedResponse.name,
                            required: parsedResponse.required,
                            schema: parsedResponse.schema,
                        },
                    ],
                };
            }

            case "bodyContent": {
                return {
                    requestBody: {
                        content: {
                            [parsedResponse.name.replace("*\\/*", "*/*")]: {
                                schema: parsedResponse.schema,
                            },
                        },
                    },
                };
            }

            case "bodyExample": {
                const [contentType, example] = parsedResponse.name.split(".");

                return {
                    requestBody: {
                        content: {
                            [contentType as string]: {
                                examples: {
                                    [example as string]: {
                                        $ref: `#/components/examples/${parsedResponse.rawType}`,
                                    },
                                },
                            },
                        },
                    },
                };
            }

            case "bodyDescription": {
                return { requestBody: { description: nameAndDescription } };
            }

            case "bodyRequired": {
                return { requestBody: { required: true } };
            }

            case "response": {
                return {
                    responses: {
                        [parsedResponse.name]: {
                            description: parsedResponse.description,
                        },
                    },
                };
            }

            case "callback": {
                return {
                    callbacks: {
                        [parsedResponse.name]: {
                            $ref: `#/components/callbacks/${parsedResponse.rawType}`,
                        },
                    },
                };
            }

            case "responseContent": {
                const [status, contentType] = parsedResponse.name.split(".");

                return {
                    responses: {
                        [status as string]: {
                            content: {
                                [contentType as string]: {
                                    schema: parsedResponse.schema,
                                },
                            },
                        },
                    },
                };
            }

            case "responseHeaderComponent": {
                const [status, header] = parsedResponse.name.split(".");

                return {
                    responses: {
                        [status as string]: {
                            headers: {
                                [header as string]: {
                                    $ref: `#/components/headers/${parsedResponse.rawType}`,
                                },
                            },
                        },
                    },
                };
            }

            case "responseHeader": {
                const [status, header] = parsedResponse.name.split(".");

                return {
                    responses: {
                        [status as string]: {
                            headers: {
                                [header as string]: {
                                    description: parsedResponse.description,
                                    schema: parsedResponse.schema,
                                },
                            },
                        },
                    },
                };
            }

            case "responseExample": {
                const [status, contentType, example] = parsedResponse.name.split(".");

                return {
                    responses: {
                        [status as string]: {
                            content: {
                                [contentType as string]: {
                                    examples: {
                                        [example as string]: {
                                            $ref: `#/components/examples/${parsedResponse.rawType}`,
                                        },
                                    },
                                },
                            },
                        },
                    },
                };
            }

            case "responseLink": {
                const [status, link] = parsedResponse.name.split(".");

                return {
                    responses: {
                        [status as string]: {
                            links: {
                                [link as string]: {
                                    $ref: `#/components/links/${parsedResponse.rawType}`,
                                },
                            },
                        },
                    },
                };
            }

            case "bodyComponent": {
                return {
                    requestBody: {
                        $ref: `#/components/requestBodies/${parsedResponse.rawType}`,
                    },
                };
            }

            case "responseComponent": {
                return {
                    responses: {
                        [parsedResponse.name]: {
                            $ref: `#/components/responses/${parsedResponse.rawType}`,
                        },
                    },
                };
            }

            case "paramComponent": {
                return {
                    parameters: [{ $ref: `#/components/parameters/${parsedResponse.rawType}` }],
                };
            }

            case "security": {
                const [security, scopeItem] = parsedResponse.name.split(".");

                let scope: string[] = [];

                if (scopeItem) {
                    scope = [scopeItem];
                }

                return {
                    security: { [security as string]: scope },
                };
            }

            default: {
                return {};
            }
        }
    });

const commentsToOpenApi = (fileContents: string, verbose?: boolean): { loc: number; spec: OpenApiObject }[] => {
    // eslint-disable-next-line regexp/no-unused-capturing-group
    const openAPIRegex = /^(GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE) \/.*$/;

    const jsDocumentComments = parseComments(fileContents, { spacing: "preserve" });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return jsDocumentComments
        .filter((comment) => openAPIRegex.test(comment.description.trim()))
        .map((comment) => {
            // Line count, number of tags + 1 for description.
            // - Don't count line-breaking due to long descriptions
            // - Don't count empty lines
            const loc = (comment.tags.length as number) + 1;

            const result = mergeWith({}, ...tagsToObjects(comment.tags, verbose), customizer);

            fixSecurityObject(result);

            const [method, path]: string[] = comment.description.split(" ");

            const pathsObject: PathsObject = {
                [(path as string).trim()]: {
                    [(method as string).toLowerCase().trim()]: {
                        ...result,
                    },
                },
            };

            // Purge all undefined objects/arrays.
            const spec = JSON.parse(JSON.stringify({ paths: pathsObject }));

            return {
                loc,
                spec,
            };
        });
};

export default commentsToOpenApi;
