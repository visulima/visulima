import createHttpError from "http-errors";
// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires namespace imports
import type * as z from "zod";

import type { FunctionLike, Nextable, NextHandler } from "../types";

/** Minimal shape of a zod issue we rely on, kept local so this module needs no zod value import. */
interface ZodIssueLike {
    message: string;
    path: (number | string | symbol)[];
}

/** Structural type for any zod-like error (duck-typed instead of `instanceof z.ZodError`). */
interface ZodErrorLike {
    issues: ZodIssueLike[];
    name?: string;
}

/**
 * Duck-type a thrown value as a zod (or Standard-Schema) validation error without importing zod
 * at runtime. This keeps `zod` an optional/type-only peer so consumers that never validate — and
 * Edge bundles in particular — do not pay for the zod value import.
 */
const isZodError = (error: unknown): error is ZodErrorLike => {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    const candidate = error as { issues?: unknown; name?: unknown };

    return Array.isArray(candidate.issues) && (candidate.name === undefined || candidate.name === "ZodError");
};

const formatIssues = (issues: ZodIssueLike[]): string => issues.map((issue) => `${issue.path.map(String).join("/")} - ${issue.message}`).join("\n");

const toHttpError = (error: unknown): never => {
    if (isZodError(error)) {
        const httpError = createHttpError(422, formatIssues(error.issues));

        // Preserve the structured issues so downstream error handlers can serialize per-field details.
        (httpError as typeof httpError & { issues: ZodIssueLike[] }).issues = error.issues;

        throw httpError;
    }

    // A non-validation error escaped the schema (e.g. thrown inside a `.transform`/`.refine`, a DB
    // lookup, etc.). http-errors marks 4xx messages `expose: true`, so reflecting `error.message`
    // back to the client would leak internal details. Use a generic public message and attach the
    // original error as `cause` for server-side logging.
    throw createHttpError(422, "Request validation failed", { cause: error });
};

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
                toHttpError(error);
            }

            return handler(transformedRequest, response, next);
        };

export default withZod;
