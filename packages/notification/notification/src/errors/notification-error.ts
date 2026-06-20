// eslint-disable-next-line import/no-extraneous-dependencies
import { VisulimaError } from "@visulima/error";

/**
 * Base error class for notification package operations.
 * @param component The component name where the error occurred.
 * @param message The error message describing what went wrong.
 * @param options Optional error options including cause, code, and hint.
 */
class NotificationError extends VisulimaError {
    public readonly component: string;

    public readonly code?: string;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    public constructor(component: string, message: string, options?: { cause?: Error | unknown; code?: string; hint?: string | string[] }) {
        super({
            cause: options?.cause,
            hint: options?.hint,
            message: `[@visulima/notification] [${component}] ${message}`,
            name: "NotificationError",
            title: `Notification ${component} Error`,
        });
        this.component = component;
        this.code = options?.code;
    }
}

export default NotificationError;
