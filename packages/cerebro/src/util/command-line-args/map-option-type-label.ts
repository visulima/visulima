import type { OptionDefinition } from "../../@types/command";
import isBoolean from "./option-is-boolean";

const getTypeLabel = <T>(definition: OptionDefinition<T>) => {
    let typeLabel = definition.type ? definition.type.name.toLowerCase() : "string";

    const multiple = definition.multiple || definition.lazyMultiple ? "[]" : "";

    if (typeLabel) {
        typeLabel = typeLabel === "boolean" ? "" : `{underline ${typeLabel}${multiple}}`;
    }

    return typeLabel;
};

const mapOptionTypeLabel = <T>(definition: OptionDefinition<T>): OptionDefinition<T> => {
    if (isBoolean(definition)) {
        return definition;
    }

    definition.typeLabel = definition.typeLabel || getTypeLabel<T>(definition);

    if (definition.defaultOption) {
        definition.typeLabel = `${definition.typeLabel} (D)`;
    }

    if (definition.required) {
        definition.typeLabel = `${definition.typeLabel} (R)`;
    }

    return definition;
};

export default mapOptionTypeLabel;
