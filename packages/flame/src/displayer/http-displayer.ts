import type { IncomingMessage, ServerResponse } from 'node:http'
import template from "../template";

const httpDisplayer = (error: Error, _request: IncomingMessage, response: ServerResponse) => {
    const html = template(error);

    response.writeHead(500, {
        'Content-Type': 'text/html'
    });

    response.write(html);
    response.end();
}

export default httpDisplayer;
