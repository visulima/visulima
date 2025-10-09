/**
 * @packageDocumentation
 * Declarative validation utilities used by storage handlers. Define validators
 * that produce consistent HTTP responses on failure.
 */
import { ErrorMap } from "./errors";
import type { Headers, HttpErrorBody, ResponseBody, ResponseTuple, UploadResponse, Validation, ValidatorConfig } from "./types";
import ValidationError from "./validation-error";

const capitalize = (s: string): string => s && (s[0] as string).toUpperCase() + s.slice(1);

const toResponse = <T extends ResponseBody>(response: ResponseTuple<T> | UploadResponse<T>): UploadResponse => {
    if (!Array.isArray(response)) {
        return response;
    }

    const [statusCode, body, headers] = response;

    return { body, headers, statusCode };
};

/**
 * Composable validator that aggregates named checks and throws
 * {@link ValidationError} with a stable error code when a check fails.
 */
export class Validator<T> {
    private validators: Record<string, Required<ValidatorConfig<T>>> = {};

    public constructor(private prefix = "ValidationError") {}

    public add(config: Validation<T>): void {
        Object.entries(config).forEach(([key, validator]) => {
            const code = `${this.prefix}${capitalize(key)}`;

            this.validators[code] = { ...this.validators[code], ...validator } as Required<ValidatorConfig<T>>;

            if (typeof this.validators[code].isValid !== "function") {
                throw new TypeError("Validation config \"isValid\" is missing, or it is not a function!");
            }
        });
    }

    public async verify(t: T): Promise<never | void> {
        for await (const [code, validator] of Object.entries(this.validators)) {
            const isValid = await validator.isValid(t);

            if (!isValid) {
                const response = toResponse(validator.response || ErrorMap[code]);
                const { body, headers, message, statusCode } = response as any;

                throw new ValidationError(code, statusCode as number, (body || message) as HttpErrorBody, headers as Headers);
            }
        }
    }
}

export const isValidationError = (error: unknown): error is ValidationError => (error as ValidationError).name === "ValidationError";
