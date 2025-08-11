import type { IncomingMessage, ServerResponse } from "node:http";

import template from "../template";
import type { Editor, SolutionFinder, Theme } from "../types";

const httpDisplayer = async (
    error: Error,
    solutionFinders: SolutionFinder[],
    options: Partial<{ editor: Editor; openInEditorUrl?: string; theme: Theme }> = {},
): Promise<(request: IncomingMessage, response: ServerResponse) => void> => {
    const html = await template(error, solutionFinders, options);

    return (_request: IncomingMessage, response: ServerResponse): void => {
        response.writeHead(500, {
            "Content-Type": "text/html",
        });

        response.write(html);
        response.end();
    };
};

export default httpDisplayer;
