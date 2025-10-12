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

    /**
     * Creates a new ValidationError instance
     * @param message Human-readable error message
     * @param code Machine-readable error code
     * @param mediaType The media type where validation failed ('image', 'video', or 'audio')
     * @param invalidParameters Array of parameter names that were invalid
     * @param validParameters Array of valid parameter names or values
     * @param suggestions Optional array of suggested corrections or valid values
     */
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
