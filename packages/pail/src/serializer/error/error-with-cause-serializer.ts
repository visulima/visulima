import type { SerializedError } from "./error-proto";
import { ErrorProto, seen } from "./error-proto";
import getType from "../../util/get-type";
import type { Serializer } from "../../types";

const errorWithCauseSerializer = (error: any): SerializedError => {
    error[seen] = undefined; // tag to prevent re-looking at this

    const protoError = Object.create(ErrorProto);

    protoError.name = Object.prototype.toString.call(error.constructor) === "[object Function]" ? error.constructor.name : error.name;
    protoError.message = error.message;
    protoError.stack = error.stack;

    if (Array.isArray(error.errors)) {
        protoError.aggregateErrors = error.errors.map((error_: any) => errorWithCauseSerializer(error_));
    }

    // Handle aggregate errors
    if (getType(error.cause) === "Error" && !Object.prototype.hasOwnProperty.call(error.cause, seen)) {
        protoError.cause = errorWithCauseSerializer(error.cause);
    }

    for (const key in error) {
        if (protoError[key] === undefined) {
            const value = error[key];

            if (getType(value) === "Error") {
                if (!Object.prototype.hasOwnProperty.call(value, seen)) {
                    protoError[key] = errorWithCauseSerializer(value);
                }
            } else {
                protoError[key] = value;
            }
        }
    }

    delete error[seen]; // clean up tag in case err is serialized again later

    protoError.raw = error;

    return protoError;
};

const serializer: Serializer = {
    name: "error",
    serialize: errorWithCauseSerializer,
    isApplicable: (value: any) => getType(value) === "Error",
};

export default serializer;
