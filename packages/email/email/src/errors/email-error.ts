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

    /**
     * True when repeating the same request would fail the same way, so a queue worker should
     * dead-letter the job instead of retrying it.
     */
    public readonly permanent: boolean;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    public constructor(component: string, message: string, options?: { cause?: Error | unknown; code?: string; hint?: string | string[]; permanent?: boolean }) {
        super({
            cause: options?.cause,
            hint: options?.hint,
            message: `[@visulima/email] [${component}] ${message}`,
            name: "EmailError",
            title: `Email ${component} Error`,
        });
        this.component = component;
        this.code = options?.code;
        this.permanent = options?.permanent ?? false;
    }
}

export default EmailError;
