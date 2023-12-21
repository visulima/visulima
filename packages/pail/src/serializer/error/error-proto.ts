export const seen = Symbol("circular-reference-tag");
export const rawSymbol = Symbol("raw-error-ref");

const errorProto = Object.create(
    {},
    {
        aggregateErrors: {
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
            get () {
                return this[rawSymbol];
            },
            set (value) {
                this[rawSymbol] = value;
            },
        },
        stack: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
        cause: {
            enumerable: true,
            value: undefined,
            writable: true,
        },
    },
);

Object.defineProperty(errorProto, rawSymbol, {
    value: {},
    writable: true,
});

export const ErrorProto = errorProto;

export type SerializedError = AggregateError & { [key: string]: any, raw: any } | Error & { [key: string]: any, raw: any };
