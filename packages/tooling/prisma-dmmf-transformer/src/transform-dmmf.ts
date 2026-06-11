import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

import getJSONSchemaModel from "./get-json-schema-model";
import type { ModelMetaData, TransformOptions } from "./types";

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

/**
 * Transform a Prisma DMMF document into a JSON Schema (draft-07) document.
 *
 * Each Prisma model and composite type becomes an entry under `definitions`, and each model gets a
 * top-level `properties` entry referencing its definition. Behaviour is controlled via
 * {@link TransformOptions}.
 * @example
 * ```ts
 * import { getDMMF } from "@prisma/internals";
 * import { transformDMMF } from "@visulima/prisma-dmmf-transformer";
 *
 * const dmmf = await getDMMF({ datamodel });
 * const schema = transformDMMF(dmmf, { includeRequiredFields: true });
 * ```
 */
const transformDmmf = (dmmf: DMMF.Document, transformOptions: TransformOptions = {}): JSONSchema7 => {
    // TODO: Remove default values as soon as prisma version < 3.10.0 doesn't have to be supported anymore
    // The `types` default guards Prisma < 3.10 where `datamodel.types` is absent at runtime even though
    // the current types mark it required, hence the disable.
    // eslint-disable-next-line @typescript-eslint/no-useless-default-assignment
    const { enums, models, types = [] } = dmmf.datamodel;
    const initialJSON = {
        $schema: "http://json-schema.org/draft-07/schema#",
        definitions: {},
        type: "object",
    } as JSONSchema7;
    const { schemaId } = transformOptions;

    // Build the enum lookup once per document so per-field enum resolution is O(1)
    // instead of an O(enums) linear scan for every field of every model.
    const enumNameToValues = new Map<string, string[]>(enums.map((enumItem) => [enumItem.name, enumItem.values.map((value) => value.name)]));
    const modelMetaData: ModelMetaData = { enumNameToValues, enums };

    const modelDefinitionsMap = models.map(getJSONSchemaModel(modelMetaData, transformOptions));

    const typeDefinitionsMap = types.map(getJSONSchemaModel(modelMetaData, transformOptions));
    const modelPropertyDefinitionsMap = models.map(getPropertyDefinition(transformOptions));
    const definitions = Object.fromEntries([...modelDefinitionsMap, ...typeDefinitionsMap]);
    const properties = Object.fromEntries(modelPropertyDefinitionsMap);

    return {
        ...schemaId ? { $id: schemaId } : undefined,
        ...initialJSON,
        definitions,
        properties,
    };
};

export default transformDmmf;
