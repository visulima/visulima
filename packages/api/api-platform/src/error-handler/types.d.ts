import type { IncomingMessage, ServerResponse } from "node:http";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Request/Response generics flow into call sites in connect/handler.ts
export type ErrorHandler = <Request extends IncomingMessage, Response extends ServerResponse>(
    error: unknown,
    request: Request,
    response: Response,
) => Promise<unknown>;

export type ErrorHandlers = {
    handler: ErrorHandler;
    regex: RegExp;
}[];

export type ApiFormat = "jsonapi" | "problem";
