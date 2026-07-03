// eslint-disable-next-line import/no-extraneous-dependencies
import { VisulimaError } from "@visulima/error";

/**
 * Base error class for Cerebro CLI operations.
 */
class CerebroError extends VisulimaError {
    public readonly code: string;

    public readonly context?: Record<string, unknown>;

    public constructor(message: string, code: string, context?: Record<string, unknown>) {
        super({
            message,
            name: "CerebroError",
        });
        this.code = code;
        this.context = context;
    }
}

export default CerebroError;
