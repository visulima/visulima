import { header as headerCase } from "case";

import type {
    OpenAPI3, ReferenceObject, ResponseObject, SchemaObject, SwaggerOptions,
} from "./types";

function extendComponentSchema(spec: OpenAPI3, schemaName: string, mediaType: string, schema: SchemaObject) {
    if (typeof spec.components !== "object") {
        // eslint-disable-next-line no-param-reassign
        spec.components = {};
    }

    if (typeof spec.components.schemas !== "object") {
        // eslint-disable-next-line no-param-reassign
        spec.components.schemas = {};
    }

    if (typeof spec.components.schemas[schemaName] === "undefined") {
        // eslint-disable-next-line radar/no-duplicate-string
        if (mediaType === "application/ld+json") {
            throw new Error("Automated JSON-LD schema generation is not supported yet");
        } else {
            // eslint-disable-next-line no-param-reassign
            spec.components.schemas[schemaName] = schema;
        }
    }
}

export default function extendSwaggerSpec(spec: OpenAPI3, swaggerOptions: SwaggerOptions): OpenAPI3 {
    if (typeof spec === "object" && typeof spec.paths === "object") {
        Object.entries(spec.paths).forEach(([pathKey, pathSpec]) => {
            Object.values(pathSpec).forEach((methodSpec) => {
                if (typeof methodSpec.responses === "object") {
                    Object.entries<ResponseObject>(methodSpec.responses).forEach(([status, responseSpec]) => {
                        if (typeof responseSpec.content === "object") {
                            Object.values(responseSpec.content).forEach((contentSpec) => {
                                if (typeof contentSpec.schema === "object") {
                                    const { schema } = contentSpec;

                                    if (typeof (schema as ReferenceObject).$ref !== "undefined") {
                                        return;
                                    }

                                    const schemaIsArray = (schema as SchemaObject).type === "array";

                                    Object.entries(swaggerOptions?.allowedMediaTypes || {}).forEach(([mediaType, allowed]) => {
                                        if (!allowed) {
                                            return;
                                        }

                                        // eslint-disable-next-line max-len
                                        const schemaName = `${headerCase(pathKey.trim().replace("/", ""))}${
                                            mediaType === "application/ld+json" ? ".jsonld" : ""
                                        }`;

                                        if ((schema as ReferenceObject).$ref === "string") {
                                            // const reference = (schema as ReferenceObject).$ref;

                                            // eslint-disable-next-line radar/no-duplicate-string
                                            if (mediaType === "application/ld+json") {
                                                throw new Error("Automated JSON-LD schema generation is not supported yet");
                                            }

                                            return;
                                        }

                                        extendComponentSchema(spec, schemaName, mediaType, schema as SchemaObject);

                                        if (typeof methodSpec?.responses?.[status]?.content[mediaType]?.schema === "undefined") {
                                            // eslint-disable-next-line no-param-reassign
                                            methodSpec.responses[status].content[mediaType] = { schema: {} };
                                        }

                                        if (mediaType === "application/ld+json") {
                                            throw new Error("Automated JSON-LD schema generation is not supported yet");
                                        } else {
                                            // eslint-disable-next-line no-param-reassign
                                            methodSpec.responses[status].content[mediaType].schema = schemaIsArray
                                                ? {
                                                    type: "array",
                                                    items: {
                                                        $ref: `#/components/schemas/${schemaName}`,
                                                    },
                                                }
                                                : {
                                                    $ref: `#/components/schemas/${schemaName}`,
                                                };
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    return spec;
}
