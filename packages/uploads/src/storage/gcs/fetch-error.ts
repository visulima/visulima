class FetchError extends Error {
    public name = "FetchError";

    constructor(message: string, public code: string, public config: { uri: string }) {
        super(message);
    }
}

export default FetchError;
