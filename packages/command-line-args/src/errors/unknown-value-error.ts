import type { VisulimaError } from "@visulima/error/error";

export class UnknownValueError extends Error implements VisulimaError {
    public readonly loc: undefined;

    public readonly title: string;

    public readonly hint: string;

    public readonly type = "VisulimaError";

    public readonly value: string;

    public constructor(value: string) {
        super(`Unknown value: ${value}`);

        this.name = "UNKNOWN_VALUE";
        this.title = "Unknown Value";
        this.hint = `Use a defined option or add a defaultOption to capture this value.`;
        this.value = value;

        // Ensure proper prototype chain for test compatibility
        Object.setPrototypeOf(this, UnknownValueError.prototype);
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
