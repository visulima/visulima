import type { VisulimaError } from "@visulima/error/error";

export class UnknownOptionError extends Error implements VisulimaError {
    public readonly loc: undefined;

    public readonly title: string;

    public readonly hint: string;

    public readonly type = "VisulimaError";

    public readonly optionName: string;

    public constructor(optionName: string) {
        super(`Unknown option: --${optionName}`);

        this.name = "UNKNOWN_OPTION";
        this.title = "Unknown Option";
        this.hint = `Check your option definitions or remove the unknown option '${optionName}' from your command line arguments.`;
        this.optionName = `--${optionName}`;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, UnknownOptionError.prototype);
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
