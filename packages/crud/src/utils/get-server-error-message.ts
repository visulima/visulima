import { ServerErrorCode } from "../types";

const getServerErrorMessage = (code: ServerErrorCode): string => {
    switch (code) {
        case ServerErrorCode.ENTITY_NOT_FOUND: {
            return "the requested entity is not found";
        }

        case ServerErrorCode.INVALID_REQUEST_PARAMS: {
            return "request parameters are invalid";
        }

        case ServerErrorCode.DENIED_BY_POLICY: {
            return "the request was denied due to access policy violation";
        }

        case ServerErrorCode.UNIQUE_CONSTRAINT_VIOLATION: {
            return "the request failed because of database unique constraint violation";
        }

        case ServerErrorCode.REFERENCE_CONSTRAINT_VIOLATION: {
            return "the request failed because of database foreign key constraint violation";
        }

        case ServerErrorCode.READ_BACK_AFTER_WRITE_DENIED: {
            return "the write operation succeeded, but the data cannot be read back due to access policy violation";
        }

        case ServerErrorCode.UNKNOWN: {
            return "an unknown error occurred";
        }

        default: {
            return `generic error: ${code}`;
        }
    }
};

export default getServerErrorMessage;
