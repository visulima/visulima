import type { IncomingMessage, ServerResponse } from "node:http";

import type { RequestHandler } from "../node";
import type { Nextable } from "../types";

type NextFunction = (error?: any) => void;

const expressWrapper = <Request extends IncomingMessage, Response extends ServerResponse>(
    function_: ExpressRequestHandler<Request, Response>,
    // eslint-disable-next-line compat/compat
): Nextable<RequestHandler<Request, Response>> => (request, response, next) => new Promise<void>((resolve, reject) => {
        function_(request, response, (error) => (error ? reject(error) : resolve()));
        // eslint-disable-next-line promise/no-callback-in-promise
    }).then(next);

export type ExpressRequestHandler<Request, Response> = (request: Request, response: Response, next: NextFunction) => void;

export default expressWrapper;
