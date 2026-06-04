import createHttpError from "http-errors";
// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires namespace imports
import * as z from "zod";

import type { FunctionLike, Nextable, NextHandler } from "../types";

const withZod
    = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ZodObject requires `any` for generic parameter compatibility
        schema: z.ZodObject<any>,
        handler: Nextable<FunctionLike>,
    ): (request: unknown, response: unknown, next: NextHandler) => Promise<unknown> =>
        async (request: unknown, response: unknown, next: NextHandler): Promise<unknown> => {
            let transformedRequest: unknown;

            try {
                transformedRequest = await schema.parseAsync(request);
            } catch (error: unknown) {
                if (error instanceof z.ZodError) {
                    const message = error.issues.map((issue) => `${issue.path.join("/")} - ${issue.message}`).join("\n");

                    const httpError = createHttpError(422, message);

                    // Preserve the structured zod issues so downstream error handlers
                    // can serialize per-field validation details.
                    (httpError as typeof httpError & { issues: z.ZodError["issues"] }).issues = error.issues;

                    throw httpError;
                }

                throw createHttpError(422, (error as Error).message);
            }

            return handler(transformedRequest, response, next);
        };

export default withZod;
