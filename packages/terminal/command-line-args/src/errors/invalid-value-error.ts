import { VisulimaError } from "@visulima/error/error";

/**
 * Error thrown when a value cannot be converted to the option's declared type
 * while `strictTypes` is enabled (e.g. a non-numeric value for a `Number` option).
 */
class InvalidValueError extends VisulimaError {
    public readonly optionName: string;

    public readonly value: string;

    /**
     * Creates a new InvalidValueError instance.
     * @param optionName The name of the option whose value failed conversion
     * @param value The offending raw value
     * @param typeName The human-readable target type (e.g. `"Number"`)
     */
    public constructor(optionName: string, value: string, typeName: string) {
        super({
            hint: `Pass a valid ${typeName} value for '${optionName}'.`,
            message: `Invalid ${typeName} value '${value}' for option '${optionName}'`,
            name: "INVALID_VALUE",
            title: "Invalid Value",
        });

        this.optionName = optionName;
        this.value = value;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, InvalidValueError.prototype);
    }
}

export default InvalidValueError;
