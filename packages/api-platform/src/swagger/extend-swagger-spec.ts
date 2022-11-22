import { header as headerCase } from "case";
import type { OpenAPIV3 } from "openapi-types";
import type { OAS3Definition, Operation, Responses } from "swagger-jsdoc";

const extendComponentSchemas = (spec: Partial<OAS3Definition>, schemaName: string, schema: OpenAPIV3.SchemaObject) => {
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

const extendComponentExamples = (spec: Partial<OAS3Definition>, exampleName: string, example: OpenAPIV3.SchemaObject) => {
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
        spec.components.examples[exampleName] = example;
    }
};

function extendSwaggerWithMediaTypeSchema(
    responseSpec: OpenAPIV3.ResponseObject,
    allowedMediaTypes: { [p: string]: boolean } | undefined,
    pathKey: string,
    spec: Partial<OAS3Definition>,
    methodSpec: Operation,
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

                extendComponentSchemas(spec as OAS3Definition, schemaName, schema as OpenAPIV3.SchemaObject);

                if (methodSpec?.responses?.[status]?.content[mediaType]?.schema === undefined) {
                    // eslint-disable-next-line no-param-reassign
                    (methodSpec.responses as Responses)[status].content[mediaType] = { schema: {} };
                }

                // eslint-disable-next-line no-param-reassign
                (methodSpec.responses as Responses)[status].content[mediaType].schema = schemaIsArray
                    ? {
                        type: "array",
                        items: {
                            $ref: `#/components/schemas/${schemaName}`,
                        },
                    }
                    : {
                        $ref: `#/components/schemas/${schemaName}`,
                    };

                if (methodSpec.produces === undefined) {
                    // eslint-disable-next-line no-param-reassign
                    methodSpec.produces = [];
                }

                methodSpec.produces.push(mediaType);
            });
        }
    });

    return examples;
}

function extendSwaggerWithMediaTypeExamples(
    responseSpec: OpenAPIV3.ResponseObject,
    allowedMediaTypes: { [p: string]: boolean } | undefined,
    pathKey: string,
    spec: Partial<OAS3Definition>,
    examples: { [p: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject } | undefined,
    methodSpec: Operation,
    status: string,
) {
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

            extendComponentExamples(spec as OAS3Definition, examplesName, examples as OpenAPIV3.SchemaObject);

            if (methodSpec?.responses?.[status]?.content[mediaType]?.examples === undefined) {
                // eslint-disable-next-line no-param-reassign
                (methodSpec.responses as Responses)[status].content[mediaType] = { examples: {} };
            }

            // eslint-disable-next-line no-param-reassign
            (methodSpec.responses as Responses)[status].content[mediaType].examples = examples;
        });
    });
}

// eslint-disable-next-line radar/cognitive-complexity
export default function extendSwaggerSpec(spec: Partial<OAS3Definition>, allowedMediaTypes?: { [key: string]: boolean }): Partial<OAS3Definition> {
    if (typeof spec === "object" && typeof spec.paths === "object") {
        Object.entries(spec.paths).forEach(([pathKey, pathSpec]) => {
            Object.values(pathSpec).forEach((methodSpec) => {
                if (typeof methodSpec.responses === "object") {
                    Object.entries<OpenAPIV3.ResponseObject>(methodSpec.responses).forEach(([status, responseSpec]) => {
                        if (typeof responseSpec.content === "object") {
                            const examples:
                            | {
                                [media: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.ExampleObject;
                            }
                            | undefined = extendSwaggerWithMediaTypeSchema(responseSpec, allowedMediaTypes, pathKey, spec, methodSpec, status);

                            if (examples !== undefined) {
                                extendSwaggerWithMediaTypeExamples(responseSpec, allowedMediaTypes, pathKey, spec, examples, methodSpec, status);
                            }
                        }
                    });
                }
            });
        });
    }

    return spec;
}
