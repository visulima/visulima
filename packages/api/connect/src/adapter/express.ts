import type { IncomingMessage, ServerResponse } from "node:http";

import type { RequestHandler } from "../node";
import type { Nextable } from "../types";

type NextFunction = (error?: Error) => void;

const expressWrapper =
    <Request extends IncomingMessage, Response extends ServerResponse>(
        function_: ExpressRequestHandler<Request, Response>,
    ): Nextable<RequestHandler<Request, Response>> =>
    async (request, response, next) => {
        await new Promise<void>((resolve, reject: (reason: Error) => void): void => {
            function_(request, response, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        return next();
    };

export type ExpressRequestHandler<Request, Response> = (request: Request, response: Response, next: NextFunction) => void;

export default expressWrapper;
