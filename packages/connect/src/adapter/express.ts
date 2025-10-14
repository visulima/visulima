import type { IncomingMessage, ServerResponse } from "node:http";

import type { RequestHandler } from "../node";
import type { Nextable } from "../types";

type NextFunction = (error?: any) => void;

const expressWrapper
    = <Request extends IncomingMessage, Response extends ServerResponse>(
        function_: ExpressRequestHandler<Request, Response>,
    ): Nextable<RequestHandler<Request, Response>> =>
        async (request, response, next) =>
        // eslint-disable-next-line compat/compat
            await new Promise<void>((resolve, reject): void => {
                function_(request, response, (error) => error ? reject(error) : resolve());
            // eslint-disable-next-line promise/no-callback-in-promise
            }).then<Nextable<RequestHandler<Request, Response>>>(next);

export type ExpressRequestHandler<Request, Response> = (request: Request, response: Response, next: NextFunction) => void;

export default expressWrapper;
