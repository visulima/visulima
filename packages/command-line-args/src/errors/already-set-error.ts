import type { VisulimaError } from "@visulima/error/error";

export class AlreadySetError extends Error implements VisulimaError {
    public readonly loc: undefined;

    public readonly title: string;

    public readonly hint: string;

    public readonly type = "VisulimaError";

    public readonly optionName: string;

    public constructor(optionName: string) {
        super(`Option '${optionName}' is already set`);

        this.name = "ALREADY_SET";
        this.title = "Option Already Set";
        this.hint = `Remove the duplicate option '${optionName}' from your command line arguments.`;
        this.optionName = optionName;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, AlreadySetError.prototype);
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
