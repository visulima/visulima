import { getReasonPhrase, StatusCodes } from "http-status-codes";

import type { SolutionFinder } from "../../types";
import template from "../../error-inspector";
import type { TemplateOptions } from "../../error-inspector/types";

type ExtraFetchHandlers = {
    regex: RegExp;
    handler: (error: unknown, request: Request) => Response | Promise<Response>;
}[];

export type FetchHandlerOptions = TemplateOptions & {
    debug?: boolean | "auto";
    showTrace?: boolean;
    extraHandlers?: ExtraFetchHandlers;
};

const extractStatusCode = (error: unknown, fallback: number = StatusCodes.INTERNAL_SERVER_ERROR): number => {
    const candidate = Number((error as { statusCode?: unknown }).statusCode ?? (error as { status?: unknown }).status);
    if (Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) {
        return candidate;
    }
    return fallback;
};

const chooseType = (acceptHeader: string | null): string => {
    const accept = (acceptHeader || "").toLowerCase();
    const has = (t: string) => accept.includes(t);

    // Server preference order
    if (has("text/html")) return "text/html";
    if (has("application/vnd.api+json")) return "application/vnd.api+json";
    if (has("application/problem+json")) return "application/problem+json";
    if (has("application/json")) return "application/json";
    if (has("text/plain")) return "text/plain";
    if (has("application/javascript") || has("text/javascript")) return "application/javascript";
    if (has("application/xml") || has("text/xml")) return "application/xml";

    return "text/html"; // default
};

const buildJsonApiBody = (statusCode: number, title: string, detail: string) => ({
    errors: [
        {
            code: statusCode,
            title,
            detail,
        },
    ],
});

const fetchHandler = async (
    error: Error,
    solutionFinders: SolutionFinder[] = [],
    options: FetchHandlerOptions = {},
): Promise<((request: Request) => Promise<Response>)> => {
    // eslint-disable-next-line no-param-reassign
    (error as Error & { expose: boolean }).expose = options.showTrace ?? true;

    return async (request: Request): Promise<Response> => {
        const accept = request.headers.get("accept");

        // Allow consumer overrides via regex on Accept
        for (const override of options.extraHandlers ?? []) {
            const headerStr = accept ?? "";
            if (override.regex.test(headerStr)) {
                return override.handler(error, request);
            }
        }

        const chosenType = chooseType(accept);
        const statusCode = extractStatusCode(error);
        const message = error.message ?? "Error";
        const stack = (error as Error).stack;

        if (chosenType === "text/html") {
            const isProduction = process.env.NODE_ENV === "production";
            const hasDebugEnv = process.env.DEBUG !== undefined;
            const debugMode = options.debug ?? "auto";
            const shouldRenderTemplate = debugMode === true || (debugMode === "auto" && (!isProduction || hasDebugEnv));

            let html: string;
            if (shouldRenderTemplate) {
                html = (await template(error, solutionFinders, options)).replace("<title>Error</title>", `<title>${getReasonPhrase(statusCode) || "Error"}</title>`);
            } else {
                html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${getReasonPhrase(statusCode) || "Error"}</title></head><body><h1>${statusCode}</h1><pre>${message}</pre></body></html>`;
            }

            return new Response(html, { status: statusCode, headers: { "content-type": "text/html; charset=utf-8" } });
        }

        if (chosenType === "application/problem+json") {
            const body = {
                type: "about:blank",
                title: getReasonPhrase(statusCode) || "An error occurred",
                status: statusCode,
                detail: message,
                ...((error as Error & { expose: boolean }).expose ? { trace: stack } : {}),
            };
            return new Response(JSON.stringify(body), { status: statusCode, headers: { "content-type": "application/problem+json" } });
        }

        if (chosenType === "application/vnd.api+json") {
            const body = buildJsonApiBody(statusCode, getReasonPhrase(statusCode) || "Error", message);
            return new Response(JSON.stringify(body), { status: statusCode, headers: { "content-type": "application/json; charset=utf-8" } });
        }

        if (chosenType === "application/json") {
            const body = { status: statusCode, message };
            return new Response(JSON.stringify(body), { status: statusCode, headers: { "content-type": "application/json; charset=utf-8" } });
        }

        if (chosenType === "text/plain") {
            return new Response(message, { status: statusCode, headers: { "content-type": "text/plain; charset=utf-8" } });
        }

        if (chosenType === "application/javascript") {
            // Minimal JSONP-style output without callback for safety
            const body = `throw new Error(${JSON.stringify(message)});`;
            return new Response(body, { status: statusCode, headers: { "content-type": "application/javascript; charset=utf-8" } });
        }

        if (chosenType === "application/xml") {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<error><status>${statusCode}</status><title>${getReasonPhrase(statusCode) || "Error"}</title><detail>${message}</detail></error>`;
            return new Response(xml, { status: statusCode, headers: { "content-type": "application/xml" } });
        }

        // Default to HTML
        const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${getReasonPhrase(statusCode) || "Error"}</title></head><body><h1>${statusCode}</h1><pre>${message}</pre></body></html>`;
        return new Response(html, { status: statusCode, headers: { "content-type": "text/html; charset=utf-8" } });
    };
};

export default fetchHandler;


