import createHttpError from "http-errors";
// eslint-disable-next-line import/no-namespace
import * as z from "zod";

import type { Nextable, NextHandler } from "../types";

const withZod
    = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: z.ZodObject<any>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: Nextable<any>,
    ): (request: unknown, response: unknown, next: NextHandler) => Promise<unknown> =>
        async (request: unknown, response: unknown, next: NextHandler): Promise<unknown> => {
            let transformedRequest: unknown;

            try {
                transformedRequest = await schema.parseAsync(request);
            } catch (error: unknown) {
                const message = error instanceof z.ZodError && typeof error.format === "function"
                    ? error.issues.map((issue) => `${issue.path.join("/")} - ${issue.message}`).join("/n")
                    : (error as Error).message;

                throw createHttpError(422, message);
            }

            return handler(transformedRequest, response, next);
        };

export default withZod;
