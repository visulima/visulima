import type { IncomingMessage, ServerResponse } from 'node:http'
import template from "../template";

const httpDisplayer = async (error: Error, _request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const html = await template(error);

    response.writeHead(500, {
        'Content-Type': 'text/html'
    });

    response.write(html);
    response.end();
}

export default httpDisplayer;
