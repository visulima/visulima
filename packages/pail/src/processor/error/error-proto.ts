// eslint-disable-next-line import/exports-last
export const seen = Symbol("circular-reference-tag");

// eslint-disable-next-line import/exports-last,import/no-unused-modules
export const rawSymbol = Symbol("raw-error-ref");

const errorProto = Object.create(
    {},
    {
        aggregateErrors: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
        cause: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
        code: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
        message: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
        name: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
        raw: {
            enumerable: false,
            get() {
                // eslint-disable-next-line security/detect-object-injection
                return this[rawSymbol];
            },
            set(value) {
                // eslint-disable-next-line security/detect-object-injection
                this[rawSymbol] = value;
            },
        },
        stack: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
    },
) as SerializedError;

Object.defineProperty(errorProto, rawSymbol, {
    value: {},
    writable: true,
});

export const ErrorProto = errorProto;

export type SerializedError<ErrorType = Error> = Record<PropertyKey, unknown> & {
    aggregateErrors?: SerializedError<ErrorType>[];
    cause?: unknown;
    code?: string;
    message: string;
    name: string;
    raw?: ErrorType;
    stack?: string;
};
