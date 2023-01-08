import { Headers, HttpErrorBody, ValidationError as IValidationError } from "./types";

class ValidationError extends Error implements IValidationError {
    name: "ValidationError" = "ValidationError";

    constructor(public code: string, public statusCode: number, public body: HttpErrorBody, public headers: Headers) {
        super(body?.message);
    }
}

export default ValidationError;
