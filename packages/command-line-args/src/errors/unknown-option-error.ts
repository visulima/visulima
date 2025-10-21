// eslint-disable-next-line import/no-extraneous-dependencies
import { VisulimaError } from "@visulima/error/error";

/**
 * Error thrown when an unknown option is encountered.
 */
class UnknownOptionError extends VisulimaError {
    public readonly optionName: string;

    /**
     * Creates a new UnknownOptionError instance.
     * @param optionName
     */
    public constructor(optionName: string) {
        super({
            cause: undefined,
            hint: `Check your option definitions or remove the unknown option '${optionName}' from your command line arguments.`,
            location: undefined,
            message: `Unknown option: --${optionName}`,
            name: "UNKNOWN_OPTION",
            stack: undefined,
            title: "Unknown Option",
        });

        this.optionName = `--${optionName}`;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, UnknownOptionError.prototype);
    }
}

export default UnknownOptionError;
