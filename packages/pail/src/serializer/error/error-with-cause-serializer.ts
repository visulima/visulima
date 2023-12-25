import type { Serializer } from "../../types";
import getType from "../../util/get-type";
import type { SerializedError } from "./error-proto";
import { ErrorProto, seen } from "./error-proto";

type CauseError = Error & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cause: any;
};

const errorWithCauseSerializer = (error: AggregateError | Error): SerializedError => {
    // eslint-disable-next-line no-param-reassign
    error[seen] = undefined; // tag to prevent re-looking at this

    const protoError = Object.create(ErrorProto) as SerializedError;

    protoError.name = Object.prototype.toString.call(error.constructor) === "[object Function]" ? error.constructor.name : error.name;
    protoError.message = error.message;
    protoError.stack = error.stack;

    if (Array.isArray((error as AggregateError).errors)) {
        protoError["aggregateErrors"] = (error as AggregateError).errors.map((error_: AggregateError | Error) => errorWithCauseSerializer(error_));
    }

    // Handle aggregate errors
    if (getType((error as CauseError).cause) === "Error" && !Object.prototype.hasOwnProperty.call((error as CauseError).cause, seen)) {
        protoError["cause"] = errorWithCauseSerializer((error as CauseError).cause);
    }

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const key in error) {
        if (protoError[key] === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,security/detect-object-injection
            const value = error[key];

            if (getType(value) === "Error") {
                if (!Object.prototype.hasOwnProperty.call(value, seen)) {
                    // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-unsafe-argument
                    protoError[key] = errorWithCauseSerializer(value);
                }
            } else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,security/detect-object-injection
                protoError[key] = value;
            }
        }
    }

    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
    delete error[seen]; // clean up tag in case err is serialized again later

    protoError.raw = error;

    return protoError;
};

const serializer: Serializer = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isApplicable: (value: any) => getType(value) === "Error",
    name: "error",
    serialize: errorWithCauseSerializer,
};

export default serializer;
