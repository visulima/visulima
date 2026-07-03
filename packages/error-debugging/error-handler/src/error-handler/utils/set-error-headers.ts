import type { ServerResponse } from "node:http";

import type { HttpError } from "http-errors";

const setErrorHeaders = (response: ServerResponse, error: unknown): void => {
    const headers: Record<string, ReadonlyArray<string> | number | string> = (error as HttpError).headers ?? {};

    Object.keys(headers).forEach((header: string) => {
        response.setHeader(header, headers[header] as ReadonlyArray<string> | number | string);
    });
};

export default setErrorHeaders;
