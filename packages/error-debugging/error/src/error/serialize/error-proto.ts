export const ErrorProto = Object.create(
    {},
    {
        cause: {
            enumerable: false,
            value: undefined,
            writable: true,
        },
        code: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
        errors: {
            enumerable: false,
            value: undefined,
            writable: true,
        },
        message: {
            enumerable: false,
            value: undefined,
            writable: true,
        },
        name: {
            enumerable: false,
            value: undefined,
            writable: true,
        },
        stack: {
            enumerable: false,
            value: undefined,
            writable: true,
        },
    },
) as SerializedError;

export type SerializedError<ErrorType = Error> = Record<PropertyKey, unknown> & {
    aggregateErrors?: SerializedError<ErrorType>[];
    cause?: unknown;
    code?: string;
    message: string;
    name: string;
    raw?: ErrorType;
    stack?: string;
};
