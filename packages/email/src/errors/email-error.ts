// eslint-disable-next-line import/no-extraneous-dependencies
import { VisulimaError } from "@visulima/error";

/**
 * Base error class for email package operations.
 * @param component The component name where the error occurred.
 * @param message The error message describing what went wrong.
 * @param options Optional error options including cause, code, and hint.
 */
class EmailError extends VisulimaError {
    public readonly component: string;

    public readonly code?: string;

    public constructor(component: string, message: string, options?: { cause?: Error | unknown; code?: string; hint?: string | string[] }) {
        super({
            cause: options?.cause,
            hint: options?.hint,
            message: `[@visulima/email] [${component}] ${message}`,
            name: "EmailError",
            title: `Email ${component} Error`,
        });
        this.component = component;
        this.code = options?.code;
    }
}

export default EmailError;
