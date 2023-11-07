import type { ErrorLocation, ErrorProperties } from "./types";

export const isVisulimaError = (error: unknown): error is VisulimaError => error instanceof Error && (error as VisulimaError).type === "VisulimaError";

export class VisulimaError extends Error {
    public loc: ErrorLocation | undefined;

    public title: string | undefined;

    /**
     * A message that explains to the user how they can fix the error.
     */
    public hint: string[] | string | undefined;

    public type = "VisulimaError";

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
    public constructor(properties: ErrorProperties, ...parameters: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        super(...parameters);

        const { hint, location, message, name, stack, title } = properties;
        this.title = title;
        this.name = name;

        if (message) {
            this.message = message;
        }

        // Only set this if we actually have a stack passed, otherwise uses Error's
        this.stack = stack ?? (this.stack as string);
        this.loc = location;
        this.hint = hint;

        Error.captureStackTrace(this, this.constructor);
    }

    public setLocation(location: ErrorLocation): void {
        this.loc = location;
    }

    public setName(name: string): void {
        this.name = name;
    }

    public setMessage(message: string): void {
        this.message = message;
    }

    public setHint(hint: string | string[]): void {
        this.hint = hint;
    }
}
