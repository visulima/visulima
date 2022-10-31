import type { IncomingMessage, ServerResponse } from "node:http";

export type ErrorHandler = <Request extends IncomingMessage, Response extends ServerResponse>(
    error: any,
    request: Request,
    response: Response,
) => any | Promise<any>;

export type ErrorHandlers = {
    regex: RegExp;
    handler: ErrorHandler;
}[];

export type ApiFormat = "jsonapi" | "problem";
