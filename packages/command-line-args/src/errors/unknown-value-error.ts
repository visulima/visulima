// eslint-disable-next-line import/no-extraneous-dependencies
import { VisulimaError } from "@visulima/error/error";

/**
 * Error thrown when an unknown value is encountered.
 */
class UnknownValueError extends VisulimaError {
    public readonly value: string;

    /**
     * Creates a new UnknownValueError instance.
     * @param value The unknown value encountered
     */
    public constructor(value: string) {
        super({
            hint: "Use a defined option or add a defaultOption to capture this value.",
            message: `Unknown value: ${value}`,
            name: "UNKNOWN_VALUE",
            title: "Unknown Value",
        });

        this.value = value;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, UnknownValueError.prototype);
    }
}

export default UnknownValueError;
