

// eslint-disable-next-line import/exports-last
export const seen = Symbol("circular-reference-tag");

// eslint-disable-next-line import/exports-last
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access,security/detect-object-injection
                return this[rawSymbol];
            },
            set(value) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,security/detect-object-injection
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SerializedError = (AggregateError & { [key: string]: any; raw: any }) | (Error & { [key: string]: any; raw: any });
