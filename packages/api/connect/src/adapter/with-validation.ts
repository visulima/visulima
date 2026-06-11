import createHttpError from "http-errors";

import type { FunctionLike, Nextable, NextHandler } from "../types";

/**
 * Minimal local copy of the Standard Schema interface (https://github.com/standard-schema/standard-schema).
 * Declared here so this adapter has zero runtime/value dependency on any specific validator library —
 * any zod v4, valibot, or arktype schema implements `~standard` and can be passed directly.
 */
interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly "~standard": {
        readonly validate: (value: unknown) => Promise<StandardSchemaV1.Result<Output>> | StandardSchemaV1.Result<Output>;
        readonly vendor: string;
        readonly version: 1;
    };
}

// eslint-disable-next-line @typescript-eslint/no-namespace -- mirrors the upstream Standard Schema namespace layout
declare namespace StandardSchemaV1 {
    interface Issue {
        readonly message: string;
        readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
    }

    interface FailureResult {
        readonly issues: ReadonlyArray<Issue>;
    }

    interface SuccessResult<Output> {
        readonly issues?: never;
        readonly value: Output;
    }

    type Result<Output> = FailureResult | SuccessResult<Output>;
}

const formatIssues = (issues: ReadonlyArray<StandardSchemaV1.Issue>): string =>
    issues
        .map((issue) => {
            const path = (issue.path ?? [])
                .map((segment) => {
                    if (typeof segment === "object") {
                        return String(segment.key);
                    }

                    return String(segment);
                })
                .join("/");

            if (path === "") {
                return issue.message;
            }

            return `${path} - ${issue.message}`;
        })
        .join("\n");

/**
 * Validate the request against any Standard Schema (zod v4, valibot, arktype, ...) before invoking
 * the handler. On failure throws a 422 `HttpError` whose body lists per-field issues; the structured
 * issues are attached as `httpError.issues` for custom error serializers.
 *
 * Unlike the zod-specific `withZod` adapter, this is decoupled from any single validator's major version.
 * @param schema A Standard Schema (anything exposing the `~standard` property).
 * @param handler The handler to run with the validated value as its first argument.
 * @example
 * import { z } from "zod";
 * router.post("/users", withValidation(z.object({ name: z.string() }), createUser));
 */
const withValidation =
    <Input, Output>(
        schema: StandardSchemaV1<Input, Output>,
        handler: Nextable<FunctionLike>,
    ): ((request: unknown, response: unknown, next: NextHandler) => Promise<unknown>) =>
    async (request: unknown, response: unknown, next: NextHandler): Promise<unknown> => {
        const result = await schema["~standard"].validate(request);

        if (result.issues !== undefined) {
            const httpError = createHttpError(422, formatIssues(result.issues));

            (httpError as typeof httpError & { issues: ReadonlyArray<StandardSchemaV1.Issue> }).issues = result.issues;

            throw httpError;
        }

        return handler(result.value, response, next);
    };

export default withValidation;
export type { StandardSchemaV1 };
