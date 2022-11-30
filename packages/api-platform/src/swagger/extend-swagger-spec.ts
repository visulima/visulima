/* eslint-disable no-param-reassign */
import { header as headerCase } from "case";
import { toXML } from "jstoxml";
import type { OpenAPIV3 } from "openapi-types";
import { stringify } from "yaml";

type Transformers = { regex: RegExp; transformer: (data: any) => string }[];

const jsonMediaType = "application/json";

const prepareStatusContent = (methodSpec: OpenAPIV3.OperationObject<{}>, status: string, mediaType: string) => {
    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content === undefined) {
        ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content = {};
    }

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType] === undefined) {
        (
            ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                [key: string]: OpenAPIV3.MediaTypeObject;
            }
        )[mediaType] = {} as OpenAPIV3.MediaTypeObject;
    }
};

const extendComponentSchemas = (spec: Partial<OpenAPIV3.Document>, schemaName: string, schema: OpenAPIV3.SchemaObject) => {
    if (typeof spec.components !== "object") {
        spec.components = {};
    }

    if (typeof spec.components.schemas !== "object") {
        spec.components.schemas = {};
    }

    if (spec.components.schemas[schemaName] === undefined) {
        spec.components.schemas[schemaName] = schema;
    }
};

const extendResponseSchema = (methodSpec: OpenAPIV3.OperationObject, status: string, mediaType: string, schemaName: string, schemaIsArray: boolean) => {
    prepareStatusContent(methodSpec, status, mediaType);

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType]?.schema === undefined) {
        (
            (
                ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                    [key: string]: OpenAPIV3.MediaTypeObject;
                }
            )[mediaType] as OpenAPIV3.MediaTypeObject
        ).schema = {} as OpenAPIV3.SchemaObject;
    }

    (
        (
            ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                [key: string]: OpenAPIV3.MediaTypeObject;
            }
        )[mediaType] as OpenAPIV3.MediaTypeObject
    ).schema = schemaIsArray
        ? {
            type: "array",
            items: {
                $ref: `#/components/schemas/${schemaName}`,
            },
        }
        : {
            $ref: `#/components/schemas/${schemaName}`,
        };
};

const extendSwaggerWithMediaTypeSchema = (
    methodSpec: OpenAPIV3.OperationObject,
    responseSpec: OpenAPIV3.ResponseObject,
    allowedMediaTypes: { [p: string]: boolean } | undefined,
    pathKey: string,
    spec: Partial<OpenAPIV3.Document>,
    status: string,
): {
    example?: any;
    examples?: {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    };
} => {
    let example: any | undefined;
    let examples:
    | {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    }
    | undefined;

    // eslint-disable-next-line radar/cognitive-complexity
    Object.entries(responseSpec.content as object).forEach(([mediaName, contentSpec]) => {
        if (typeof contentSpec.schema === "object") {
            const { schema } = contentSpec;

            if (mediaName === jsonMediaType && contentSpec.examples !== undefined) {
                examples = contentSpec.examples;
            } else if (mediaName === jsonMediaType && contentSpec.example !== undefined) {
                example = contentSpec.example;
            }

            const schemaIsArray = (schema as OpenAPIV3.SchemaObject).type === "array";

            Object.entries(allowedMediaTypes || {}).forEach(([mediaType, allowed]) => {
                if (!allowed) {
                    return;
                }

                let schemaName: string;

                if ((schema as OpenAPIV3.ReferenceObject).$ref === undefined) {
                    // eslint-disable-next-line max-len
                    schemaName = `${headerCase(pathKey.trim().replace("/", ""))}${mediaType === "application/ld+json" ? ".jsonld" : ""}`;

                    extendComponentSchemas(spec as OpenAPIV3.Document, schemaName, schema as OpenAPIV3.SchemaObject);
                } else {
                    // eslint-disable-next-line max-len
                    schemaName = (schema as OpenAPIV3.ReferenceObject).$ref.replace("#/components/schemas/", "");
                }

                extendResponseSchema(methodSpec, status, mediaType, schemaName, schemaIsArray);
            });
        }
    });

    return { examples, example };
};

const extendSwaggerWithMediaTypeExample = (
    methodSpec: OpenAPIV3.OperationObject,
    responseSpec: OpenAPIV3.ResponseObject,
    status: string,
    allowedMediaTypes: { [p: string]: boolean } | undefined,
    transformers: Transformers,
    example: any,
) => {
    Object.keys(responseSpec.content as object).forEach((mediaName) => {
        if (mediaName === jsonMediaType) {
            return;
        }

        Object.entries(allowedMediaTypes || {}).forEach(([mediaType, allowed]) => {
            if (!allowed) {
                return;
            }

            prepareStatusContent(methodSpec, status, mediaType);

            if (
                ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType]?.example
                === undefined
            ) {
                (
                    (
                        ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                            [key: string]: OpenAPIV3.MediaTypeObject;
                        }
                    )[mediaType] as OpenAPIV3.MediaTypeObject
                ).example = {};
            }

            let transformed = false;

            transformers.forEach(({ regex, transformer }) => {
                if (!transformed && regex.test(mediaType)) {
                    (
                        (
                            ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                                [key: string]: OpenAPIV3.MediaTypeObject;
                            }
                        )[mediaType] as OpenAPIV3.MediaTypeObject
                    ).example = transformer(example);

                    transformed = true;
                }
            });

            if (!transformed) {
                (
                    (
                        ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                            [key: string]: OpenAPIV3.MediaTypeObject;
                        }
                    )[mediaType] as OpenAPIV3.MediaTypeObject
                ).example = example;
            }
        });
    });
};

const extendComponentExamples = (
    spec: Partial<OpenAPIV3.Document>,
    exampleName: string,
    examples: {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    },
) => {
    if (typeof spec.components !== "object") {
        spec.components = {};
    }

    if (typeof spec.components.examples !== "object") {
        spec.components.examples = {};
    }

    if (spec.components.examples[exampleName] === undefined && examples[exampleName] !== undefined) {
        spec.components.examples[exampleName] = examples[exampleName] as OpenAPIV3.ExampleObject;
    }
};

const prepareResponseExamples = (
    spec: Partial<OpenAPIV3.Document>,
    methodSpec: OpenAPIV3.OperationObject,
    status: string,
    mediaType: string,
    transformers: Transformers,
    examples: {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    },
    // eslint-disable-next-line radar/cognitive-complexity
) => {
    prepareStatusContent(methodSpec, status, mediaType);

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType]?.examples === undefined) {
        (
            (
                ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                    [key: string]: OpenAPIV3.MediaTypeObject;
                }
            )[mediaType] as OpenAPIV3.MediaTypeObject
        ).examples = {};
    }

    const transformedExamples: {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    } = {};

    Object.entries(examples).forEach(([exampleName, example]) => {
        let transformed = false;

        transformers.forEach(({ regex, transformer }) => {
            if (!transformed && regex.test(mediaType)) {
                let data: any = "";

                if ((spec.components?.examples?.[exampleName] as OpenAPIV3.ExampleObject) !== undefined) {
                    data = (spec.components?.examples?.[exampleName] as OpenAPIV3.ExampleObject).value;
                } else if (example as OpenAPIV3.ReferenceObject) {
                    data = (
                        spec.components?.examples?.[
                            (example as OpenAPIV3.ReferenceObject).$ref.replace("#/components/examples/", "")
                        ] as OpenAPIV3.ExampleObject
                    ).value;
                } else if (typeof (example as OpenAPIV3.ExampleObject)?.value === "string") {
                    data = (example as OpenAPIV3.ExampleObject).value;
                }

                transformedExamples[exampleName] = {
                    value: transformer(data),
                };

                transformed = true;
            }
        });

        if (!transformed) {
            transformedExamples[exampleName] = spec.components?.examples?.[exampleName] === undefined
                ? example
                : {
                    $ref: `#/components/examples/${exampleName}`,
                };
        }
    });

    (
        (
            ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                [key: string]: OpenAPIV3.MediaTypeObject;
            }
        )[mediaType] as OpenAPIV3.MediaTypeObject
    ).examples = transformedExamples;
};

const extendSwaggerWithMediaTypeExamples = (
    spec: Partial<OpenAPIV3.Document>,
    methodSpec: OpenAPIV3.OperationObject,
    status: string,
    responseSpec: OpenAPIV3.ResponseObject,
    allowedMediaTypes: { [p: string]: boolean } | undefined,
    pathKey: string,
    transformers: Transformers,
    examples: {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    },
) => {
    const examplesName = `${headerCase(pathKey.trim().replace("/", ""))}`;

    Object.keys(responseSpec.content as object).forEach((mediaName) => {
        if (mediaName === jsonMediaType) {
            return;
        }

        Object.entries(allowedMediaTypes || {}).forEach(([mediaType, allowed]) => {
            if (!allowed) {
                return;
            }

            extendComponentExamples(spec, examplesName, examples);

            prepareResponseExamples(spec, methodSpec, status, mediaType, transformers, examples);
        });
    });
};

// eslint-disable-next-line radar/cognitive-complexity
export default function extendSwaggerSpec(
    spec: Partial<OpenAPIV3.Document>,
    allowedMediaTypes?: { [key: string]: boolean },
    transformers: Transformers = [
        {
            regex: /xml/,
            transformer: (value) => toXML(value, {
                header: true,
                indent: "  ",
            }),
        },
        {
            regex: /yaml|yml/,
            transformer: (value) => stringify(value, { indent: 2 }),
        },
    ],
): Partial<OpenAPIV3.Document> {
    if (typeof spec === "object" && typeof spec.paths === "object") {
        Object.entries(spec.paths).forEach(([pathKey, pathSpec]) => {
            Object.values(pathSpec as OpenAPIV3.PathsObject & OpenAPIV3.OperationObject).forEach((methodSpec) => {
                if (typeof (methodSpec as OpenAPIV3.OperationObject).responses === "object") {
                    Object.entries((methodSpec as OpenAPIV3.OperationObject).responses).forEach(([status, responseSpec]) => {
                        if (typeof (responseSpec as OpenAPIV3.ResponseObject).content === "object") {
                            const { examples, example } = extendSwaggerWithMediaTypeSchema(
                                methodSpec as OpenAPIV3.OperationObject,
                                responseSpec as OpenAPIV3.ResponseObject,
                                allowedMediaTypes,
                                pathKey,
                                spec,
                                status,
                            );

                            if (example !== undefined) {
                                extendSwaggerWithMediaTypeExample(
                                    methodSpec as OpenAPIV3.OperationObject,
                                    responseSpec as OpenAPIV3.ResponseObject,
                                    status,
                                    allowedMediaTypes,
                                    transformers,
                                    example,
                                );
                            } else if (examples !== undefined) {
                                extendSwaggerWithMediaTypeExamples(
                                    spec,
                                    methodSpec as OpenAPIV3.OperationObject,
                                    status,
                                    responseSpec as OpenAPIV3.ResponseObject,
                                    allowedMediaTypes,
                                    pathKey,
                                    transformers,
                                    examples,
                                );
                            }
                        }
                    });
                }
            });
        });
    }

    return spec;
}

/* eslint-enable no-param-reassign */
