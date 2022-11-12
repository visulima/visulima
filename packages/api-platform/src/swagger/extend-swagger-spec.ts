import { header as headerCase } from "case";

import type { OpenAPIV3 } from "openapi-types";
import type { OAS3Definition } from "swagger-jsdoc";

const extendComponentSchema = (spec: Partial<OAS3Definition>, schemaName: string, schema: OpenAPIV3.SchemaObject) => {
    if (typeof spec.components !== "object") {
        // eslint-disable-next-line no-param-reassign
        spec.components = {};
    }

    if (typeof spec.components.schemas !== "object") {
        // eslint-disable-next-line no-param-reassign
        spec.components.schemas = {};
    }

    if (typeof spec.components.schemas[schemaName] === "undefined") {
        // eslint-disable-next-line no-param-reassign
        spec.components.schemas[schemaName] = schema;
    }
}

// eslint-disable-next-line radar/cognitive-complexity
export default function extendSwaggerSpec(spec: Partial<OAS3Definition>, allowedMediaTypes?: { [key: string]: boolean }): Partial<OAS3Definition> {
    if (typeof spec === "object" && typeof spec.paths === "object") {
        Object.entries(spec.paths).forEach(([pathKey, pathSpec]) => {
            Object.values(pathSpec).forEach((methodSpec) => {
                if (typeof methodSpec.responses === "object") {
                    Object.entries<OpenAPIV3.ResponseObject>(methodSpec.responses).forEach(([status, responseSpec]) => {
                        if (typeof responseSpec.content === "object") {
                            Object.values(responseSpec.content).forEach((contentSpec) => {
                                if (typeof contentSpec.schema === "object") {
                                    const { schema } = contentSpec;

                                    if (typeof (schema as OpenAPIV3.ReferenceObject).$ref !== "undefined") {
                                        return;
                                    }

                                    const schemaIsArray = (schema as OpenAPIV3.SchemaObject).type === "array";

                                    Object.entries(allowedMediaTypes || {}).forEach(([mediaType, allowed]) => {
                                        if (!allowed) {
                                            return;
                                        }

                                        // eslint-disable-next-line max-len
                                        const schemaName = `${headerCase(pathKey.trim().replace("/", ""))}${
                                            mediaType === "application/ld+json" ? ".jsonld" : ""
                                        }`;

                                        extendComponentSchema(spec as OAS3Definition, schemaName, schema as OpenAPIV3.SchemaObject);

                                        if (typeof methodSpec?.responses?.[status]?.content[mediaType]?.schema === "undefined") {
                                            // eslint-disable-next-line no-param-reassign
                                            methodSpec.responses[status].content[mediaType] = { schema: {} };
                                        }

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
