// eslint-disable-next-line import/no-extraneous-dependencies
import { VisulimaError } from "@visulima/error/error";

/**
 * Error thrown when an option is already set (duplicate assignment).
 */
class AlreadySetError extends VisulimaError {
    public readonly optionName: string;

    /**
     * Creates a new AlreadySetError instance.
     * @param optionName The name of the option that was already set
     */
    public constructor(optionName: string) {
        super({
            cause: undefined,
            hint: `Remove the duplicate option '${optionName}' from your command line arguments.`,
            location: undefined,
            message: `Option '${optionName}' is already set`,
            name: "ALREADY_SET",
            stack: undefined,
            title: "Option Already Set",
        });

        this.optionName = optionName;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, AlreadySetError.prototype);
    }
}

export default AlreadySetError;
