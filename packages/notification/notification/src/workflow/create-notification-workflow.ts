import type { Duration, MaybePromise, WorkflowConfig, WorkflowDefinition, WorkflowRun } from "@visulima/workflow";
import { defineWorkflow } from "@visulima/workflow";

import NotificationError from "../errors/notification-error";
import type { ChannelPayloadMap, Notification } from "../notification";
import type { ChannelType, Receipt } from "../types";

/** The context handed to a step resolver / skip predicate. */
interface StepResolverContext<PayloadT> {
    /** The validated trigger payload of the run. */
    payload: PayloadT;
}

/** Resolves the payload sent by a channel step (or decides to skip it). */
type StepResolver<PayloadT, ResultT> = (context: StepResolverContext<PayloadT>) => MaybePromise<ResultT>;

/** Per-step options for a channel step. */
interface ChannelStepOptions<PayloadT> {
    /** Skip the send when this returns `true`; the step records `undefined`. */
    skip?: (context: StepResolverContext<PayloadT>) => MaybePromise<boolean>;

    /**
     * Treat a `FailureReceipt` as a thrown error so the run fails and the step
     * re-runs on the next resume/sweep. Defaults to `false`.
     */
    throwOnFailure?: boolean;
}

/**
 * A durable channel step. Resolves a channel payload and delivers it through the
 * bound {@link Notification} facade exactly once; the receipt is recorded and
 * returned on replay without re-sending. Returns `undefined` when `skip` matches.
 *
 * IMPORTANT: a delivery failure surfaces as a `FailureReceipt` (the facade does not
 * throw), so by default a failed send is **recorded as a completed step and not
 * retried** — inspect `receipt.successful`, or pass `throwOnFailure: true` to turn
 * a failure into a thrown error that re-runs the step on the next activation.
 */
type ChannelStep<ChannelT extends ChannelType, PayloadT> = (
    id: string,
    resolve: StepResolver<PayloadT, ChannelPayloadMap[ChannelT]>,
    options?: ChannelStepOptions<PayloadT>,
) => Promise<Receipt | undefined>;

/**
 * The `step` object handed to a notification workflow body. Channel steps deliver
 * exactly once; `delay` pauses durably; `custom` is an escape hatch to the raw
 * engine step.
 */
interface NotificationStep<PayloadT> {
    chat: ChannelStep<"chat", PayloadT>;
    custom: <T>(id: string, function_: () => MaybePromise<T>) => Promise<T>;
    delay: (id: string, duration: Duration) => Promise<void>;
    email: ChannelStep<"email", PayloadT>;
    inApp: ChannelStep<"inapp", PayloadT>;
    push: ChannelStep<"push", PayloadT>;
    sms: ChannelStep<"sms", PayloadT>;
    webhook: ChannelStep<"webhook", PayloadT>;
}

/** The body of a notification workflow, driven by {@link NotificationStep}. */
type NotificationWorkflowRun<PayloadT, OutputT> = (context: { payload: PayloadT; runId: string; step: NotificationStep<PayloadT> }) => MaybePromise<OutputT>;

/** Config for {@link createNotificationWorkflow}: a {@link WorkflowConfig} whose `run` is notification-flavoured. */
interface NotificationWorkflowConfig<PayloadT, OutputT> extends Omit<WorkflowConfig<PayloadT, OutputT>, "run"> {
    run: NotificationWorkflowRun<PayloadT, OutputT>;
}

/**
 * Define a durable notification workflow on top of [`@visulima/workflow`](https://visulima.com/packages/workflow).
 *
 * The returned value is a plain `WorkflowDefinition`, so it plugs straight into a
 * workflow runtime (`createRuntime({ workflows: [wf] })` → `runtime.trigger(wf, payload)`).
 * Channel steps deliver through the bound `notification` facade exactly once.
 * @param notification The multi-channel facade messages are delivered through.
 * @param config The workflow id, optional payload schema, and notification-flavoured `run`.
 * @returns A {@link WorkflowDefinition} ready to register/trigger on a runtime.
 * @example
 * ```ts
 * const onComment = createNotificationWorkflow(notify, {
 *     id: "comment-posted",
 *     payload: z.object({ subscriberId: z.string(), author: z.string() }),
 *     run: async ({ step, payload }) => {
 *         await step.inApp("inbox", () => ({ to: payload.subscriberId, body: `${payload.author} commented` }));
 *         await step.delay("cooldown", { amount: 1, unit: "hours" });
 *         await step.email("nudge", () => ({ from: "x@y.com", to: payload.subscriberId, subject: "New comment", html: "<p>…</p>" }));
 *     },
 * });
 * ```
 */
const createNotificationWorkflow = <PayloadT = unknown, OutputT = unknown>(
    notification: Notification,
    config: NotificationWorkflowConfig<PayloadT, OutputT>,
): WorkflowDefinition<PayloadT, OutputT> => {
    const run: WorkflowRun<PayloadT, OutputT> = (context) => {
        const send = async <ChannelT extends ChannelType>(
            channel: ChannelT,
            id: string,
            resolve: StepResolver<PayloadT, ChannelPayloadMap[ChannelT]>,
            options?: ChannelStepOptions<PayloadT>,
        ): Promise<Receipt | undefined> =>
            context.step(id, async (): Promise<Receipt | undefined> => {
                const skipped = options?.skip ? await options.skip({ payload: context.payload }) : false;

                if (skipped) {
                    return undefined;
                }

                const payload = await resolve({ payload: context.payload });
                const receipt = await notification.sendToChannel(channel, payload);

                if (options?.throwOnFailure && !receipt.successful) {
                    // Surface the failure as a throw so the engine fails the run and re-runs this step.
                    throw new NotificationError(channel, receipt.errorMessages.join("; "));
                }

                return receipt;
            });

        const step: NotificationStep<PayloadT> = {
            chat: (id, resolve, options) => send("chat", id, resolve, options),
            custom: (id, function_) => context.step(id, function_),
            delay: (id, duration) => context.sleep(id, duration),
            email: (id, resolve, options) => send("email", id, resolve, options),
            inApp: (id, resolve, options) => send("inapp", id, resolve, options),
            push: (id, resolve, options) => send("push", id, resolve, options),
            sms: (id, resolve, options) => send("sms", id, resolve, options),
            webhook: (id, resolve, options) => send("webhook", id, resolve, options),
        };

        return config.run({ payload: context.payload, runId: context.runId, step });
    };

    return defineWorkflow<PayloadT, OutputT>({ id: config.id, payload: config.payload, run, tags: config.tags });
};

export type { ChannelStep, ChannelStepOptions, NotificationStep, NotificationWorkflowConfig, NotificationWorkflowRun, StepResolver, StepResolverContext };
export default createNotificationWorkflow;
