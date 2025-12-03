// eslint-disable-next-line import/no-extraneous-dependencies
import { VisulimaError } from "@visulima/error/error";

/**
 * Error thrown when option definitions are invalid.
 */
class InvalidDefinitionsError extends VisulimaError {
    /**
     * Creates a new InvalidDefinitionsError instance.
     * @param message The error message describing the invalid definition
     * @param hint Optional hint for resolving the error
     */
    public constructor(message: string, hint?: string) {
        super({
            cause: undefined,
            hint,
            location: undefined,
            message,
            name: "INVALID_DEFINITIONS",
            stack: undefined,
            title: "Invalid Option Definition",
        });

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, InvalidDefinitionsError.prototype);
    }
}

export default InvalidDefinitionsError;
