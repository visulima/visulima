import type { Headers, HttpErrorBody, ValidationError as IValidationError } from "./types";

class ValidationError extends Error implements IValidationError {
    public override name: string = "ValidationError";

    public constructor(
        public code: string,
        public statusCode: number,
        public body: HttpErrorBody,
        public headers: Headers,
    ) {
        super(typeof body === "string" ? body : body?.message);
    }
}

export default ValidationError;
