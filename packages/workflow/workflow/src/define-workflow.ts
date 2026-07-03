import type { StandardSchemaV1 } from "@standard-schema/spec";

import WorkflowError from "./errors";
import type { WorkflowConfig, WorkflowDefinition } from "./types";
import { WORKFLOW_BRAND } from "./types";

/**
 * Validate an input against a Standard Schema, throwing a {@link WorkflowError}
 * with the formatted issues on failure.
 */
const formatPathSegment = (segment: PropertyKey | { key: PropertyKey }): string => {
    if (typeof segment === "object") {
        return String(segment.key);
    }

    return String(segment);
};

const formatIssue = (issue: StandardSchemaV1.Issue): string => {
    const path = issue.path?.map((segment) => formatPathSegment(segment)).join(".") ?? "";

    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
};

const validateStandard = async <PayloadT>(schema: StandardSchemaV1<unknown, PayloadT>, input: unknown): Promise<PayloadT> => {
    let result = schema["~standard"].validate(input);

    if (result instanceof Promise) {
        result = await result;
    }

    if (result.issues) {
        const message = result.issues.map((issue) => formatIssue(issue)).join("; ");

        throw new WorkflowError("invalid-payload", `Workflow payload validation failed: ${message}`);
    }

    return result.value;
};

/**
 * Define a durable workflow. This is an identity helper that brands the config
 * and attaches a `parsePayload` method derived from the optional Standard Schema.
 *
 * The `payload` schema may be any Standard Schema validator (Zod, Valibot,
 * ArkType, …); only its `~standard` contract is used.
 * @param config The workflow configuration.
 * @returns A branded {@link WorkflowDefinition}.
 * @example
 * ```ts
 * const welcome = defineWorkflow({
 *     id: "welcome",
 *     payload: z.object({ userId: z.string() }),
 *     run: async (ctx) => {
 *         await ctx.step("greet", () => sendGreeting(ctx.payload.userId));
 *         await ctx.sleep("wait", { amount: 1, unit: "days" });
 *         await ctx.step("nudge", () => sendNudge(ctx.payload.userId));
 *     },
 * });
 * ```
 */
const defineWorkflow = <PayloadT = unknown, OutputT = unknown>(config: WorkflowConfig<PayloadT, OutputT>): WorkflowDefinition<PayloadT, OutputT> => {
    const parsePayload = async (input: unknown): Promise<PayloadT> => {
        if (config.payload) {
            return validateStandard(config.payload, input);
        }

        return input as PayloadT;
    };

    return {
        ...config,
        parsePayload,
        [WORKFLOW_BRAND]: true,
    };
};

export default defineWorkflow;
