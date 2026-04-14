import type { IncomingMessage, ServerResponse } from "node:http";

export type ErrorHandler = (error: Error, request: IncomingMessage, response: ServerResponse) => Promise<void> | void;

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
