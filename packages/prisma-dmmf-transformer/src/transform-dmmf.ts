import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

import getJSONSchemaModel from "./model";
import type { TransformOptions } from "./types";

const toCamelCase = (name: string): string => name.slice(0, 1).toLowerCase() + name.slice(1);

const getPropertyDefinition
    = ({ schemaId }: TransformOptions) =>
        (model: DMMF.Model): [name: string, reference: JSONSchema7Definition] => {
            const reference = `#/definitions/${model.name}`;

            return [
                toCamelCase(model.name),
                {
                    $ref: schemaId ? `${schemaId}${reference}` : reference,
                },
            ];
        };

const transformDmmf = (dmmf: DMMF.Document, transformOptions: TransformOptions = {}): JSONSchema7 => {
    // TODO: Remove default values as soon as prisma version < 3.10.0 doesn't have to be supported anymore
    const { enums = [], models = [], types = [] } = dmmf.datamodel;
    const initialJSON = {
        $schema: "http://json-schema.org/draft-07/schema#",
        definitions: {},
        type: "object",
    } as JSONSchema7;
    const { schemaId } = transformOptions;

    const modelDefinitionsMap = models.map(getJSONSchemaModel({ enums }, transformOptions));

    const typeDefinitionsMap = types.map(getJSONSchemaModel({ enums }, transformOptions));
    const modelPropertyDefinitionsMap = models.map(getPropertyDefinition(transformOptions));
    const definitions = Object.fromEntries([...modelDefinitionsMap, ...typeDefinitionsMap]);
    const properties = Object.fromEntries(modelPropertyDefinitionsMap);

    return {
        ...schemaId ? { $id: schemaId } : null,
        ...initialJSON,
        definitions,
        properties,
    };
};

export default transformDmmf;
