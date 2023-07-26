import type { IncomingMessage, ServerResponse } from "node:http";

export type ErrorHandler = <Request extends IncomingMessage, Response extends ServerResponse>(
    error: any,
    request: Request,
    response: Response,
) => Promise<any> | any;

export type ErrorHandlers = {
    handler: ErrorHandler;
    regex: RegExp;
}[];

export type ApiFormat = "jsonapi" | "problem";
