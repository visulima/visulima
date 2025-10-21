import type { VisulimaError } from "@visulima/error/error";

export class InvalidDefinitionsError extends Error implements VisulimaError {
    public readonly loc: undefined;

    public readonly title: string;

    public readonly hint?: string;

    public readonly type = "VisulimaError";

    public constructor(message: string, hint?: string) {
        super(message);

        this.name = "INVALID_DEFINITIONS";
        this.title = "Invalid Option Definition";
        this.hint = hint;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, InvalidDefinitionsError.prototype);
    }

    public setLocation(): void {
        // No-op for this error type
    }

    public setName(name: string): void {
        this.name = name;
    }

    public setMessage(message: string): void {
        this.message = message;
    }

    public setHint(hint: string): void {
        (this as any).hint = hint;
    }
}
