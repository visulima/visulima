import type { IncomingMessage, ServerResponse } from "node:http";

export type ErrorHandler = <Request extends IncomingMessage, Response extends ServerResponse>(
    error: Error,
    request: Request,
    response: Response,
) => Promise<void> | void;

export type FetchErrorHandler = (error: unknown, request: Request) => Promise<Response>;

export type ErrorHandlers = {
    handler: ErrorHandler;
    regex: RegExp;
}[];

export type FetchErrorHandlers = {
    handler: FetchErrorHandler;
    regex: RegExp;
}[];

export type ApiFormat = "jsonapi" | "problem" | "html";
