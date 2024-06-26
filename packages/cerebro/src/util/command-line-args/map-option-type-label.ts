import type { OptionDefinition, PossibleOptionDefinition } from "../../@types/command";
import isBoolean from "./option-is-boolean";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTypeLabel = <OD extends OptionDefinition<any>>(definition: PossibleOptionDefinition<OD>) => {
    let typeLabel = definition.type ? definition.type.name.toLowerCase() : "string";

    const multiple = definition.multiple ?? definition.lazyMultiple ? "[]" : "";

    if (typeLabel) {
        typeLabel = typeLabel === "boolean" ? "" : `{underline ${typeLabel}${multiple}}`;
    }

    return typeLabel;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapOptionTypeLabel = <OD extends OptionDefinition<any>>(definition: PossibleOptionDefinition<OD>): PossibleOptionDefinition<OD> => {
    if (isBoolean(definition)) {
        return definition;
    }

    // eslint-disable-next-line no-param-reassign
    definition.typeLabel = definition.typeLabel ?? getTypeLabel<OD>(definition);

    if (definition.defaultOption) {
        // eslint-disable-next-line no-param-reassign
        definition.typeLabel = `${definition.typeLabel} (D)`;
    }

    if (definition.required) {
        // eslint-disable-next-line no-param-reassign
        definition.typeLabel = `${definition.typeLabel} (R)`;
    }

    return definition;
};

export default mapOptionTypeLabel;
