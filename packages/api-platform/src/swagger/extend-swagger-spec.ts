/* eslint-disable no-param-reassign */
import { header as headerCase } from "case";
import type { OpenAPIV3 } from "openapi-types";
import { toXML } from "jstoxml";
import { stringify } from "yaml";

type Transformers = { regex: RegExp; transformer: (data: any) => string }[];

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

    if (spec.components.examples[exampleName] === undefined) {
        spec.components.examples[exampleName] = examples[exampleName] as OpenAPIV3.ExampleObject;
    }
};

const prepareResponseExamples = (
    spec: Partial<OpenAPIV3.Document>,
    methodSpec: OpenAPIV3.OperationObject,
    status: string,
    mediaType: string,
    examples: {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    },
    transformers: Transformers,
) => {
    if ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject) === undefined) {
        methodSpec.responses = {};
    }

    if ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] === undefined) {
        (methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] = {} as OpenAPIV3.ResponseObject;
    }

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
                transformedExamples[exampleName] = {
                    value: transformer((spec.components?.examples?.[exampleName] as OpenAPIV3.ExampleObject)?.value || example),
                };

                transformed = true;
            }
        });

        if (!transformed) {
            transformedExamples[exampleName] =
                spec.components?.examples?.[exampleName] === undefined
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

const prepareResponseSchema = (methodSpec: OpenAPIV3.OperationObject, status: string, mediaType: string, schemaName: string, schemaIsArray: boolean) => {
    if ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject) === undefined) {
        methodSpec.responses = {};
    }

    if ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] === undefined) {
        (methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] = {} as OpenAPIV3.ResponseObject;
    }

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

function extendSwaggerWithMediaTypeSchema(
    responseSpec: OpenAPIV3.ResponseObject,
    allowedMediaTypes: { [p: string]: boolean } | undefined,
    pathKey: string,
    spec: Partial<OpenAPIV3.Document>,
    methodSpec: OpenAPIV3.OperationObject,
    status: string,
    transformers: Transformers,
) {
    console.log(transformers);
    let examples:
        | {
              [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
          }
        | undefined;

    // eslint-disable-next-line radar/cognitive-complexity
    Object.entries(responseSpec.content as object).forEach(([mediaName, contentSpec]) => {
        if (typeof contentSpec.schema === "object") {
            const { schema } = contentSpec;

            if (mediaName === "application/json" && contentSpec.examples !== undefined) {
                examples = contentSpec.examples;
            }

            if ((schema as OpenAPIV3.ReferenceObject).$ref !== undefined) {
                return;
            }

            const schemaIsArray = (schema as OpenAPIV3.SchemaObject).type === "array";

            Object.entries(allowedMediaTypes || {}).forEach(([mediaType, allowed]) => {
                if (!allowed) {
                    return;
                }

                // eslint-disable-next-line max-len
                const schemaName = `${headerCase(pathKey.trim().replace("/", ""))}${mediaType === "application/ld+json" ? ".jsonld" : ""}`;

                extendComponentSchemas(spec as OpenAPIV3.Document, schemaName, schema as OpenAPIV3.SchemaObject);

                prepareResponseSchema(methodSpec, status, mediaType, schemaName, schemaIsArray);
            });
        }
    });

    return examples;
}

const extendSwaggerWithMediaTypeExamples = (
    responseSpec: OpenAPIV3.ResponseObject,
    allowedMediaTypes: { [p: string]: boolean } | undefined,
    pathKey: string,
    spec: Partial<OpenAPIV3.Document>,
    examples: {
        [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
    },
    methodSpec: OpenAPIV3.OperationObject,
    status: string,
    transformers: Transformers,
) => {
    Object.keys(responseSpec.content as object).forEach((mediaName) => {
        if (mediaName === "application/json") {
            return;
        }

        Object.entries(allowedMediaTypes || {}).forEach(([mediaType, allowed]) => {
            if (!allowed) {
                return;
            }

            // eslint-disable-next-line max-len
            const examplesName = `${headerCase(pathKey.trim().replace("/", ""))}${mediaType === "application/ld+json" ? ".jsonld" : ""}`;

            extendComponentExamples(spec, examplesName, examples);

            prepareResponseExamples(spec, methodSpec, status, mediaType, examples, transformers);
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
            transformer: (value) => {
                return toXML(value, {
                    header: true,
                    indent: "  ",
                });
            },
        },
        {
            regex: /yaml|yml/,
            transformer: (value) => {
                return stringify(value, { indent: 2 });
            },
        },
    ],
): Partial<OpenAPIV3.Document> {
    if (typeof spec === "object" && typeof spec.paths === "object") {
        Object.entries(spec.paths).forEach(([pathKey, pathSpec]) => {
            Object.values(pathSpec as OpenAPIV3.PathsObject & OpenAPIV3.OperationObject).forEach((methodSpec) => {
                if (typeof (methodSpec as OpenAPIV3.OperationObject).responses === "object") {
                    Object.entries((methodSpec as OpenAPIV3.OperationObject).responses).forEach(([status, responseSpec]) => {
                        if (typeof (responseSpec as OpenAPIV3.ResponseObject).content === "object") {
                            const examples:
                                | {
                                      [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
                                  }
                                | undefined = extendSwaggerWithMediaTypeSchema(
                                responseSpec as OpenAPIV3.ResponseObject,
                                allowedMediaTypes,
                                pathKey,
                                spec,
                                methodSpec as OpenAPIV3.OperationObject,
                                status,
                                transformers,
                            );

                            if (examples !== undefined) {
                                extendSwaggerWithMediaTypeExamples(
                                    responseSpec as OpenAPIV3.ResponseObject,
                                    allowedMediaTypes,
                                    pathKey,
                                    spec,
                                    examples,
                                    methodSpec as OpenAPIV3.OperationObject,
                                    status,
                                    transformers,
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
