/**
 * Custom error class for validation failures
 */
class ValidationError extends Error {
    public readonly code: string;

    public readonly details: {
        invalidParams: string[];
        mediaType: string;
        suggestions?: string[];
        validParams: string[];
    };

    public constructor(message: string, code: string, mediaType: string, invalidParameters: string[], validParameters: string[], suggestions?: string[]) {
        super(message);

        this.name = "ValidationError";
        this.code = code;
        this.details = {
            invalidParams: invalidParameters,
            mediaType,
            suggestions,
            validParams: validParameters,
        };
    }
}

export default ValidationError;
