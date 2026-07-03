import type { ErrorHint, ErrorLocation, ErrorProperties } from "./types";

export const isVisulimaError = (error: unknown): error is VisulimaError => error instanceof Error && (error as VisulimaError).type === "VisulimaError";

export class VisulimaError extends Error {
    public loc: ErrorLocation | undefined;

    public title: string | undefined;

    /**
     * A message that explains to the user how they can fix the error.
     */
    public hint: ErrorHint | undefined;

    public type = "VisulimaError";

    public constructor({ cause, hint, location, message, name, stack, title }: ErrorProperties) {
        super(message, {
            cause,
        });

        this.title = title;
        this.name = name;

        // Only set this if we actually have a stack passed, otherwise uses Error's
        this.stack = stack ?? (this.stack as string);
        this.loc = location;
        this.hint = hint;
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

    public setHint(hint: ErrorHint): void {
        this.hint = hint;
    }
}
