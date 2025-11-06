import createHttpError from "http-errors";
import type { ZodObject } from "zod";
import { ZodError } from "zod";

import type { Nextable, NextHandler } from "../types";

const withZod
    = <Request, Response, Handler extends Nextable<any>, Schema extends ZodObject<{ body?: ZodObject<any>; headers?: ZodObject<any>; query?: ZodObject<any> }>>(
        schema: Schema,
        handler: Handler,
    ): (request: Request, response: Response, next: NextHandler) => Promise<Response> =>
        async (request: Request, response: Response, next) => {
            let transformedRequest: Request = request;

            try {
                transformedRequest = (await schema.parseAsync(request)) as Request;
            } catch (error: any) {
                let { message } = error as Error;

                if (error instanceof ZodError && typeof error.format === "function") {
                    message = error.issues.map((issue) => `${issue.path.join("/")} - ${issue.message}`).join("/n");
                }

                throw createHttpError(422, message);
            }

            return handler(transformedRequest, response, next);
        };

export default withZod;
