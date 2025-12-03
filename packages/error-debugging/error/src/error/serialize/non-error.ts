/**
 * NonError class for deserializing non-error-like objects
 */
class NonError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "NonError";
    }
}

export default NonError;
