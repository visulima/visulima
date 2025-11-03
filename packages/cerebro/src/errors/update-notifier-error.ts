import CerebroError from "./cerebro-error";

/**
 * Error thrown when update notifier operations fail.
 */
export default class UpdateNotifierError extends CerebroError {
    public constructor(message: string, code: string = "UPDATE_NOTIFIER_ERROR", context?: Record<string, unknown>) {
        super(message, code, context);
        this.name = "UpdateNotifierError";
    }
}

