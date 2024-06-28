import type { Options as ErrorWithCauseSerializerOptions } from "../serialize/serialize";
import { serialize } from "../serialize/serialize";

export type Options = ErrorWithCauseSerializerOptions & {

};

export const renderTerminal = (error: AggregateError | Error, options: Options = {}): string => {
    const { useToJSON, maxDepth } = options;

    const serializedError = serialize(error, { maxDepth, useToJSON });

    return "renderTerminal";
};
