import type { IncomingMessage, ServerResponse } from "node:http";

import template from "../template";
import type { SolutionFinder } from "../types";

const httpDisplayer = async (error: Error, solutionFinders: SolutionFinder[]): Promise<(request: IncomingMessage, response: ServerResponse) => void> => {
    const html = await template(error, solutionFinders);
    // const html = await template(error, solutionFinders);

    return (_request: IncomingMessage, response: ServerResponse): void => {
        response.writeHead(500, {
            "Content-Type": "text/html",
        });

        response.write(html);
        response.end();
    };
};

export default httpDisplayer;
