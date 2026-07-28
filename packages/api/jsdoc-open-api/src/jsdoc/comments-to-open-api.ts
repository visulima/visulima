import type { Block, Spec } from "comment-parser";
import { parse as parseComments } from "comment-parser";
import { mergeWith } from "es-toolkit";

import type { OpenApiObject, PathsObject } from "../exported";
import customizer from "../util/customizer";

const ARRAY_SUFFIX_REGEX = /\[\]$/;
const DESCRIPTION_DASH_REGEX = /^- /u;
const PARAM_SUFFIX_REGEX = /Param$/u;
// eslint-disable-next-line regexp/no-unused-capturing-group
const OPEN_API_REGEX = /^(GET|PUT|POST|DELETE|OPTIONS|HEAD|PATCH|TRACE) \/.*$/;

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

const primitiveTypes = new Set(["array", "boolean", "integer", "number", "object", "string"]);

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
    const parsedType = rawType.replace(ARRAY_SUFFIX_REGEX, "");

    const isPrimitive = primitiveTypes.has(parsedType);
    const isFormat = Object.keys(formatMap).includes(parsedType);

    let defaultValue;

    if (tag.default) {
        switch (parsedType) {
            case "double":
            case "float":
            case "number": {
                defaultValue = Number.parseFloat(tag.default);
                break;
            }
            case "int32":
            case "int64":
            case "integer": {
                defaultValue = Number.parseInt(tag.default, 10);
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
        rootType = { $ref: `#/components/schemas/${parsedType}` };
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
    let description: string | undefined = tag.description.trim().replace(DESCRIPTION_DASH_REGEX, "");

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

const tagsToObjects = (tags: Spec[], _verbose?: boolean) =>
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
            case "bodyComponent": {
                return {
                    requestBody: {
                        $ref: `#/components/requestBodies/${parsedResponse.rawType}`,
                    },
                };
            }
            case "bodyContent": {
                return {
                    requestBody: {
                        content: {
                            [parsedResponse.name.replaceAll(String.raw`*\/*`, "*/*")]: {
                                schema: parsedResponse.schema,
                            },
                        },
                    },
                };
            }
            case "bodyDescription": {
                return { requestBody: { description: nameAndDescription } };
            }

            case "bodyExample": {
                // Media types can contain dots (e.g. application/vnd.api+json), so the
                // example name is the trailing segment and everything before it is the
                // content type.
                const bodyExampleSegments = parsedResponse.name.split(".");
                const example = bodyExampleSegments.at(-1);
                const contentType = bodyExampleSegments.slice(0, -1).join(".");

                return {
                    requestBody: {
                        content: {
                            [contentType]: {
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

            case "bodyRequired": {
                return { requestBody: { required: true } };
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

            case "cookieParam":
            case "headerParam":
            case "pathParam":
            case "queryParam": {
                return {
                    parameters: [
                        {
                            description: parsedResponse.description,
                            in: tag.tag.replace(PARAM_SUFFIX_REGEX, ""),
                            name: parsedResponse.name,
                            required: parsedResponse.required,
                            schema: parsedResponse.schema,
                        },
                    ],
                };
            }
            case "deprecated": {
                return { deprecated: true };
            }

            case "description":
            case "operationId":
            case "summary": {
                return { [tag.tag]: nameAndDescription };
            }

            case "externalDocs": {
                return {
                    externalDocs: {
                        description: parsedResponse.description,
                        url: parsedResponse.name,
                    },
                };
            }

            case "paramComponent": {
                return {
                    parameters: [{ $ref: `#/components/parameters/${parsedResponse.rawType}` }],
                };
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

            case "responseComponent": {
                return {
                    responses: {
                        [parsedResponse.name]: {
                            $ref: `#/components/responses/${parsedResponse.rawType}`,
                        },
                    },
                };
            }

            case "responseContent": {
                // Split off the status positionally; the remaining segments form the
                // content type, which may itself contain dots (e.g. application/vnd.api+json).
                const responseContentSegments = parsedResponse.name.split(".");
                const status = responseContentSegments[0];
                const contentType = responseContentSegments.slice(1).join(".");

                return {
                    responses: {
                        [status as string]: {
                            content: {
                                [contentType]: {
                                    schema: parsedResponse.schema,
                                },
                            },
                        },
                    },
                };
            }

            case "responseExample": {
                // Status is the first segment and the example name the last; the content
                // type is everything in between, so vendor media types with dots survive.
                const responseExampleSegments = parsedResponse.name.split(".");
                const status = responseExampleSegments[0];
                const example = responseExampleSegments.at(-1);
                const contentType = responseExampleSegments.slice(1, -1).join(".");

                return {
                    responses: {
                        [status as string]: {
                            content: {
                                [contentType]: {
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

            default: {
                return {};
            }
        }
    });

const commentsToOpenApi = (fileContents: string, verbose?: boolean, comments?: Block[]): { loc: number; spec: OpenApiObject }[] => {
    // Reuse already-parsed blocks when provided (see `parseFileMulti`) to avoid a
    // redundant `comment-parser` pass.
    const jsDocumentComments = comments ?? parseComments(fileContents, { spacing: "preserve" });

    return jsDocumentComments
        .filter((comment) => OPEN_API_REGEX.test(comment.description.trim()))
        .map((comment) => {
            // Line count, number of tags + 1 for description.
            // - Don't count line-breaking due to long descriptions
            // - Don't count empty lines
            const loc = comment.tags.length + 1;

            const result: Record<string, any> = {};

            for (const source of tagsToObjects(comment.tags, verbose)) {
                mergeWith(result, source as Record<string, any>, customizer);
            }

            fixSecurityObject(result);

            const [method, path]: string[] = comment.description.split(" ");

            const pathsObject: PathsObject = {
                [(path as string).trim()]: {
                    [(method as string).toLowerCase().trim()]: {
                        ...result,
                    },
                },
            };

            // Purge all undefined properties — the JSON roundtrip drops them, which
            // structuredClone would preserve.
            // eslint-disable-next-line unicorn/prefer-structured-clone
            const spec = JSON.parse(JSON.stringify({ paths: pathsObject }));

            return {
                loc,
                spec,
            };
        });
};

export default commentsToOpenApi;
