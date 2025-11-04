import CerebroError from "./cerebro-error";

/**
 * Error thrown when security validation fails.
 */
class SecurityError extends CerebroError {
    public constructor(message: string, code: string, context?: Record<string, unknown>) {
        super(message, code, context);
        this.name = "SecurityError";
    }
}

export default SecurityError;
