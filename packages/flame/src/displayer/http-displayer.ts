import type { IncomingMessage, ServerResponse } from "node:http";

import template from "../template";
import type { DisplayerOptions, SolutionFinder } from "../types";

const httpDisplayer = async (
    error: Error,
    solutionFinders: SolutionFinder[],
    options: DisplayerOptions = {},
): Promise<(request: IncomingMessage, response: ServerResponse) => Promise<void>> => {
    return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        const autoRequestContext = options.context?.request
            ? undefined
            : {
                  method: request.method,
                  url: request.url,
                  status: response.statusCode,
                  headers: Object.fromEntries(
                      Object.entries(request.headers)
                          .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
                          .map(([k, v]) => [k, v as string | string[]]),
                  ),
              };

        const mergedOptions: DisplayerOptions = {
            ...options,
            context: {
                ...(options.context || {}),
                request: options.context?.request ?? autoRequestContext,
            },
        };

        const html = await template(error, solutionFinders, mergedOptions);

        response.writeHead(500, {
            "Content-Type": "text/html",
        });

        response.write(html);
        response.end();
    };
};

export default httpDisplayer;
