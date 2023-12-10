import type { PossibleOptionDefinition } from "../../@types/command";
import isBoolean from "./option-is-boolean";

const getTypeLabel = <T>(definition: PossibleOptionDefinition<T>) => {
    let typeLabel = definition.type ? definition.type.name.toLowerCase() : "string";

    const multiple = definition.multiple ?? definition.lazyMultiple ? "[]" : "";

    if (typeLabel) {
        typeLabel = typeLabel === "boolean" ? "" : `{underline ${typeLabel}${multiple}}`;
    }

    return typeLabel;
};

const mapOptionTypeLabel = <T>(definition: PossibleOptionDefinition<T>): PossibleOptionDefinition<T> => {
    if (isBoolean(definition)) {
        return definition;
    }

    // eslint-disable-next-line no-param-reassign
    definition.typeLabel = definition.typeLabel ?? getTypeLabel<T>(definition);

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
