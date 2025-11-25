import { ErrorMap } from "./errors";
import type { Headers, HttpErrorBody, ResponseBody, ResponseTuple, UploadResponse, Validation, ValidatorConfig } from "./types";
import ValidationError from "./validation-error";

/**
 * Capitalizes the first character of a string.
 * @param s String to capitalize
 * @returns Capitalized string
 */
const capitalize = (s: string): string => s && (s[0] as string).toUpperCase() + s.slice(1);

/**
 * Normalizes different response formats to a consistent UploadResponse shape.
 * @param response Response in tuple or object format
 * @returns Normalized response object
 * @template T - Response body type
 */
const toResponse = <T extends ResponseBody>(response: ResponseTuple<T> | UploadResponse<T>): UploadResponse => {
    if (!Array.isArray(response)) {
        return response;
    }

    const [statusCode, body, headers] = response;

    return { body, headers, statusCode };
};

/**
 * Configurable validation system for file upload constraints.
 * Supports multiple validation rules with custom error responses.
 * @template T - The type being validated
 */
export class Validator<T> {
    private validators: Record<string, Required<ValidatorConfig<T>>> = {};

    /**
     * Creates a new Validator instance.
     * @param prefix Prefix for generated error codes (default: "ValidationError")
     */
    public constructor(private prefix = "ValidationError") {}

    /**
     * Adds validation rules to the validator.
     * Each rule must include an `isValid` function.
     * @param config Validation configuration object
     * @throws TypeError if any validator is missing the isValid function
     */
    public add(config: Validation<T>): void {
        Object.entries(config).forEach(([key, validator]) => {
            const code = `${this.prefix}${capitalize(key)}`;

            this.validators[code] = { ...this.validators[code], ...validator } as Required<ValidatorConfig<T>>;

            if (typeof this.validators[code].isValid !== "function") {
                throw new TypeError("Validation config \"isValid\" is missing, or it is not a function!");
            }
        });
    }

    /**
     * Verifies an object against all configured validation rules.
     * Throws ValidationError on first validation failure.
     * @param t Object to validate
     * @throws ValidationError if validation fails
     */
    public async verify(t: T): Promise<never | void> {
        for (const [code, validator] of Object.entries(this.validators)) {
            const isValid = await validator.isValid(t);

            if (!isValid) {
                const errorResponse = validator.response || (code in ErrorMap ? ErrorMap[code as keyof typeof ErrorMap] : ErrorMap.UnknownError);
                const response = toResponse(errorResponse);
                const { body, headers, message, statusCode } = response as {
                    body?: unknown;
                    headers?: Record<string, unknown>;
                    message?: string;
                    statusCode?: number;
                };

                throw new ValidationError(code, statusCode as number, (body || message) as HttpErrorBody, headers as Headers);
            }
        }
    }
}

/**
 * Type guard to check if an error is a ValidationError instance.
 * @param error Error to check
 * @returns True if the error is a ValidationError
 */
export const isValidationError = (error: unknown): error is ValidationError => (error as ValidationError).name === "ValidationError";
