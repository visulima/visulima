import { ErrorMap } from "./errors";
import type {
    Headers, HttpErrorBody, ResponseBody, ResponseTuple, UploadResponse, Validation, ValidatorConfig,
} from "./types.d";
import ValidationError from "./validation-error";

const capitalize = (s: string): string => s && (s[0] as string).toUpperCase() + s.slice(1);

const toResponse = <T extends ResponseBody>(response: ResponseTuple<T> | UploadResponse<T>): UploadResponse => {
    if (!Array.isArray(response)) {
        return response;
    }

    const [statusCode, body, headers] = response;

    return { statusCode, body, headers };
};

class Validator<T> {
    private validators: Record<string, Required<ValidatorConfig<T>>> = {};

    constructor(private prefix = "ValidationError") {}

    add(config: Validation<T>): void {
        Object.entries(config).forEach(([key, validator]) => {
            const code = `${this.prefix}${capitalize(key)}`;

            this.validators[code] = { ...this.validators[code], ...validator } as Required<ValidatorConfig<T>>;

            if (typeof (this.validators[code] as Required<ValidatorConfig<T>>).isValid !== "function") {
                throw new TypeError('Validation config "isValid" is missing, or it is not a function!');
            }
        });
    }

    async verify(t: T): Promise<void | never> {
        // eslint-disable-next-line no-restricted-syntax
        for await (const [code, validator] of Object.entries(this.validators)) {
            const isValid = await validator.isValid(t);

            if (!isValid) {
                const { statusCode, body, headers } = toResponse(validator.response || ErrorMap[code]);

                throw new ValidationError(code, statusCode as number, body as HttpErrorBody, headers as Headers);
            }
        }
    }
}

export function isValidationError(error: unknown): error is ValidationError {
    return (error as ValidationError).name === "ValidationError";
}

export default Validator;
