import type { Input, Modifier } from "./types";
import objectPathResolver from "./utils/object-path-resolver";

// Check if value is either an array or an object
const isObjectOrArray = (value: unknown): boolean | null => Array.isArray(value) || (typeof value === "object" && value && value.constructor === Object);

// Handle value type checking for applying rules recursive
const deep = (input: Input, modifier: Modifier, redact: (input: Input, modifier: Modifier) => Input): void => {
    const inputKeys = Object.keys(input);
    const inputKeysLength = inputKeys.length;

    let keyObject = inputKeys[0] as keyof Input;
    // eslint-disable-next-line security/detect-object-injection
    let valueObject = input[keyObject];

    if (inputKeysLength === 1) {
        // Boost performance
        if (isObjectOrArray(valueObject)) {
            redact(valueObject as Record<string, unknown>, modifier);
        }
    } else {
        let inputKeysIndex = 0;

        // eslint-disable-next-line no-loops/no-loops
        while (inputKeysIndex < inputKeysLength) {
            // eslint-disable-next-line security/detect-object-injection
            keyObject = inputKeys[inputKeysIndex] as keyof Input;
            // eslint-disable-next-line security/detect-object-injection
            valueObject = input[keyObject];

            if (isObjectOrArray(valueObject)) {
                redact(valueObject as Record<string, unknown>, modifier);
            }

            // eslint-disable-next-line no-plusplus
            inputKeysIndex++;
        }
    }
};

export const objectModifier = <V = Input>(input: V, modifier: Record<string, unknown>, redact: (input: V, modifier: Modifier) => V) => {
    const modifierKeys = Object.keys(modifier);

    let modifierKeysIndex = 0;

    // eslint-disable-next-line no-loops/no-loops
    while (modifierKeysIndex < modifierKeys.length) {
        const keyOpt = modifierKeys[modifierKeysIndex] as keyof Modifier;
        const valueOpt = modifier[modifierKeys[modifierKeysIndex]];

        // Check if value is object and might have further complexity
        if (typeof valueOpt === "object" && valueOpt && valueOpt.constructor === Object) {
            // Check value and rules
            const valueOfValueOpt = (valueOpt as Record<string, unknown>).value;
            const ruleOfValueOpt = (valueOpt as Record<string, unknown>).rule as Record<string, unknown>;
            const directOfValueOpt = (valueOpt as Record<string, unknown>).direct === true;

            const valueOfValueOptDefined = "value" in valueOpt;
            const ruleOfValueOptDefined = "rule" in valueOpt;

            // Check if input contains property
            if (!input[keyOpt]) {
                const temporary: Record<string, unknown> = {};

                temporary[keyOpt] = valueOpt;

                const res = objectPathResolver(temporary);

                if (res?.[keyOpt]) {
                    input[keyOpt] = res[keyOpt];
                }
            }

            // Catch a direct path to a value
            if ((!ruleOfValueOptDefined && !valueOfValueOptDefined) || directOfValueOpt) {
                const valueOptKeys = Object.keys(valueOpt);
                const valueOptKeysLength = valueOptKeys.length;

                if (valueOptKeysLength === 1) {
                    redact(input[keyOpt] as V, valueOpt as Record<string, unknown>);
                } else {
                    let valueOptKeysIndex = 0;

                    // Loop through key value pairs
                    // eslint-disable-next-line no-loops/no-loops
                    while (valueOptKeysIndex < valueOptKeysLength) {
                        const temporary: Record<string, unknown> = {};

                        temporary[valueOptKeys[valueOptKeysIndex]] = (valueOpt as Record<string, unknown>)[valueOptKeys[valueOptKeysIndex] as keyof Modifier];

                        redact(input[keyOpt] as V, temporary);

                        valueOptKeysIndex++;
                    }
                }
            } else {
                const flagDeep = (valueOpt as Record<string, unknown>).deep === true; // Applies the rules in value to all nested objects for key
                const flagDefault = (valueOpt as Record<string, unknown>).default === true; // Set value of key value if no value was set for key in input

                // Check if key is to be set
                if ((flagDefault && !input[keyOpt]) || (valueOfValueOptDefined && !flagDefault)) {
                    input[keyOpt] = valueOfValueOpt;
                }
                // Check if one should remove key
                else if (ruleOfValueOpt === null && !valueOfValueOptDefined) {
                    delete input[keyOpt];
                }
                // Check for a nested rule
                else if (ruleOfValueOpt && typeof ruleOfValueOpt === "object" && ruleOfValueOpt.constructor === Object) {
                    redact(input[keyOpt] as V, ruleOfValueOpt);
                }
                // Check for nested rules in a array
                else if (Array.isArray(ruleOfValueOpt)) {
                    redact(input[keyOpt] as V, ruleOfValueOpt);
                }

                if (flagDeep) {
                    // Pass only necessary property value pair
                    const temporary: Record<string, unknown> = {};

                    temporary[keyOpt] = valueOpt;

                    deep(input, temporary, redact);
                }
            }
        } else if (valueOpt === null) {
            // Remove key if it was just set to null
            delete input[keyOpt];
        }

        modifierKeysIndex++;
    }
};
