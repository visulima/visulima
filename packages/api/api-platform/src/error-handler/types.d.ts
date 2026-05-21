import type { IncomingMessage, ServerResponse } from "node:http";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Request/Response generics flow into call sites in connect/handler.ts
export type ErrorHandler = <Request extends IncomingMessage, Response extends ServerResponse>(
    error: unknown,
    request: Request,
    response: Response,
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- handlers may return either sync (void) or a Promise.
) => void | Promise<unknown>;

export type ErrorHandlers = {
    handler: ErrorHandler;
    regex: RegExp;
}[];

export type ApiFormat = "jsonapi" | "problem";
