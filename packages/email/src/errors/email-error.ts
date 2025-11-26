import { VisulimaError } from "@visulima/error";

/**
 * Base error class for email package operations
 * @param component The component name where the error occurred
 * @param message The error message
 * @param options Optional error options (cause, code, hint)
 */
export class EmailError extends VisulimaError {
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

/**
 * Error for missing required options
 * @param component The component name where the error occurred
 * @param name The name(s) of the missing required option(s)
 */
export class RequiredOptionError extends EmailError {
    public constructor(component: string, name: string | string[]) {
        const message = Array.isArray(name) ? `Missing required options: ${name.map((n) => `'${n}'`).join(", ")}` : `Missing required option: '${name}'`;

        super(component, message, {
            hint: Array.isArray(name)
                ? `Please provide the following required options: ${name.map((n) => `'${n}'`).join(", ")}`
                : `Please provide the required option: '${name}'`,
        });
        this.name = "RequiredOptionError";
    }
}
