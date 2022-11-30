import { header as headerCase } from "case";
import type { OpenAPIV3 } from "openapi-types";

const extendComponentSchemas = (spec: Partial<OpenAPIV3.Document>, schemaName: string, schema: OpenAPIV3.SchemaObject) => {
    if (typeof spec.components !== "object") {
        // eslint-disable-next-line no-param-reassign
        spec.components = {};
    }

    if (typeof spec.components.schemas !== "object") {
        // eslint-disable-next-line no-param-reassign
        spec.components.schemas = {};
    }

    if (spec.components.schemas[schemaName] === undefined) {
        // eslint-disable-next-line no-param-reassign
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
        // eslint-disable-next-line no-param-reassign
        spec.components = {};
    }

    if (typeof spec.components.examples !== "object") {
        // eslint-disable-next-line no-param-reassign
        spec.components.examples = {};
    }

    if (spec.components.examples[exampleName] === undefined) {
        // eslint-disable-next-line no-param-reassign
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
) => {
    if ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject) === undefined) {
        // eslint-disable-next-line no-param-reassign
        methodSpec.responses = {};
    }

    if ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] === undefined) {
        // eslint-disable-next-line no-param-reassign
        (methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] = {} as OpenAPIV3.ResponseObject;
    }

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content === undefined) {
        // eslint-disable-next-line no-param-reassign
        ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content = {};
    }

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType] === undefined) {
        // eslint-disable-next-line no-param-reassign
        (
            ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                [key: string]: OpenAPIV3.MediaTypeObject;
            }
        )[mediaType] = {} as OpenAPIV3.MediaTypeObject;
    }

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType]?.examples === undefined) {
        // eslint-disable-next-line no-param-reassign
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
        if (spec.components?.examples?.[exampleName] !== undefined) {
            transformedExamples[exampleName] = {
                $ref: `#/components/examples/${exampleName}`,
            };
        } else {
            transformedExamples[exampleName] = example;
        }
    });

    // eslint-disable-next-line no-param-reassign
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
        // eslint-disable-next-line no-param-reassign
        methodSpec.responses = {};
    }

    if ((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] === undefined) {
        // eslint-disable-next-line no-param-reassign
        (methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] = {} as OpenAPIV3.ResponseObject;
    }

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content === undefined) {
        // eslint-disable-next-line no-param-reassign
        ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content = {};
    }

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType] === undefined) {
        // eslint-disable-next-line no-param-reassign
        (
            ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                [key: string]: OpenAPIV3.MediaTypeObject;
            }
        )[mediaType] = {} as OpenAPIV3.MediaTypeObject;
    }

    if (((methodSpec?.responses as unknown as OpenAPIV3.ResponsesObject)?.[status] as OpenAPIV3.ResponseObject)?.content?.[mediaType]?.schema === undefined) {
        // eslint-disable-next-line no-param-reassign
        (
            (
                ((methodSpec.responses as unknown as OpenAPIV3.ResponsesObject)[status] as OpenAPIV3.ResponseObject).content as {
                    [key: string]: OpenAPIV3.MediaTypeObject;
                }
            )[mediaType] as OpenAPIV3.MediaTypeObject
        ).schema = {} as OpenAPIV3.SchemaObject;
    }

    // eslint-disable-next-line no-param-reassign
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
) {
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

            prepareResponseExamples(spec, methodSpec, status, mediaType, examples);
        });
    });
};

// eslint-disable-next-line radar/cognitive-complexity
export default function extendSwaggerSpec(spec: Partial<OpenAPIV3.Document>, allowedMediaTypes?: { [key: string]: boolean }): Partial<OpenAPIV3.Document> {
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
