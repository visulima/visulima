import type { Meta, Processor } from "../../types";
import type { SerializedError } from "./error-proto";
import errorWithCauseSerializer from "./error-with-cause-serializer";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace VisulimaPail {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        interface CustomMeta<L> {
            error: SerializedError | undefined;
        }
    }
}

class ErrorProcessor<L extends string = string> implements Processor<L> {
    private readonly _options: { maxDepth: number; useToJSON: boolean };

    public constructor(options: { maxDepth?: number; useToJSON?: boolean } = {}) {
        this._options = {
            maxDepth: Number.POSITIVE_INFINITY,
            useToJSON: true,
            ...options,
        };
    }

    public process(meta: Meta<L>): Meta<L> {
        if (meta.error) {
            // eslint-disable-next-line no-param-reassign
            meta.error = errorWithCauseSerializer(meta.error, this._options);
        }

        return meta;
    }
}

export default ErrorProcessor;
