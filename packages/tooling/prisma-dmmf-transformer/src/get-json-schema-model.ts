import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7Definition } from "json-schema";

import getJSONSchemaProperty from "./get-json-schema-property";
import type { DefinitionMap, ModelMetaData, TransformOptions } from "./types";
import isOptionEnabled from "./utils/is-option-enabled";

const getRelationScalarFields = (model: DMMF.Model): Set<string> => new Set(model.fields.flatMap((field) => field.relationFromFields ?? []));

const getJSONSchemaModel =
    (modelMetaData: ModelMetaData, transformOptions: TransformOptions) =>
    (model: DMMF.Model): DefinitionMap => {
        const definitionPropertiesMap = model.fields.map(getJSONSchemaProperty(modelMetaData, transformOptions));

        const propertiesMap = definitionPropertiesMap.map(([name, definition]) => [name, definition] as DefinitionMap);
        const relationScalarFields = getRelationScalarFields(model);
        const propertiesWithoutRelationScalars = propertiesMap.filter((property) => !relationScalarFields.has(property[0]));

        const properties = Object.fromEntries(isOptionEnabled(transformOptions.keepRelationScalarFields) ? propertiesMap : propertiesWithoutRelationScalars);

        const definition: JSONSchema7Definition = {
            properties,
            type: "object",
        };

        if (isOptionEnabled(transformOptions.includeRequiredFields)) {
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
