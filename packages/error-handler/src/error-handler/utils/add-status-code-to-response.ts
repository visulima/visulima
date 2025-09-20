import type { ServerResponse } from "node:http";

import type { HttpError } from "http-errors";
import { StatusCodes } from "http-status-codes";

export const addStatusCodeToResponse = (response: ServerResponse, error: unknown): void => {
    const error_ = error as Partial<HttpError>;
    const candidate = Number(error_.statusCode ?? error_.status);

    if (Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) {
        response.statusCode = candidate;

        return;
    }

    if (response.statusCode < 400) {
        response.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    }
};
