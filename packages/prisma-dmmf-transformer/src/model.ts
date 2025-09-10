import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7Definition } from "json-schema";

import getJSONSchemaProperty from "./properties";
import type { DefinitionMap, ModelMetaData, TransformOptions } from "./types";

const getRelationScalarFields = (model: DMMF.Model): string[] => model.fields.flatMap((field) => field.relationFromFields ?? []);

const getJSONSchemaModel
    = (modelMetaData: ModelMetaData, transformOptions: TransformOptions) =>
        (model: DMMF.Model): DefinitionMap => {
            const definitionPropertiesMap = model.fields.map(getJSONSchemaProperty(modelMetaData, transformOptions));

            const propertiesMap = definitionPropertiesMap.map(([name, definition]) => [name, definition] as DefinitionMap);
            const relationScalarFields = getRelationScalarFields(model);
            const propertiesWithoutRelationScalars = propertiesMap.filter((property) => !relationScalarFields.includes(property[0]));

            const properties = Object.fromEntries(transformOptions.keepRelationScalarFields === "true" ? propertiesMap : propertiesWithoutRelationScalars);

            const definition: JSONSchema7Definition = {
                properties,
                type: "object",
            };

            if (transformOptions.includeRequiredFields) {
            // eslint-disable-next-line unicorn/no-array-reduce
                definition.required = definitionPropertiesMap.reduce((filtered: string[], [name, , fieldMetaData]) => {
                    if (fieldMetaData.required && fieldMetaData.isScalar && !fieldMetaData.hasDefaultValue) {
                        filtered.push(name);
                    }

                    return filtered;
                }, []);
            }

            return [model.name, definition];
        };

export default getJSONSchemaModel;
