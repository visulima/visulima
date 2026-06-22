import type { Duration, MaybePromise, WorkflowConfig, WorkflowDefinition, WorkflowRun } from "@visulima/workflow";
import { defineWorkflow } from "@visulima/workflow";

import type { ChannelPayloadMap, Notification } from "../notification";
import type { ChannelType, Receipt } from "../types";

/** The context handed to a step resolver / skip predicate. */
interface StepContext<PayloadT> {
    /** The validated trigger payload of the run. */
    payload: PayloadT;
}

/** Resolves the payload sent by a channel step (or decides to skip it). */
type StepResolver<PayloadT, ResultT> = (context: StepContext<PayloadT>) => MaybePromise<ResultT>;

/**
 * A durable channel step. Resolves a channel payload and delivers it through the
 * bound {@link Notification} facade exactly once; the receipt is recorded and
 * returned on replay without re-sending. Returns `undefined` when `skip` matches.
 */
type ChannelStep<ChannelT extends ChannelType, PayloadT> = (
    id: string,
    resolve: StepResolver<PayloadT, ChannelPayloadMap[ChannelT]>,
    options?: { skip?: (context: StepContext<PayloadT>) => MaybePromise<boolean> },
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
            options?: { skip?: (stepContext: StepContext<PayloadT>) => MaybePromise<boolean> },
        ): Promise<Receipt | undefined> =>
            context.step(id, async (): Promise<Receipt | undefined> => {
                const skipped = options?.skip ? await options.skip({ payload: context.payload }) : false;

                if (skipped) {
                    return undefined;
                }

                const payload = await resolve({ payload: context.payload });

                return notification.sendToChannel(channel, payload);
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

export type { ChannelStep, NotificationStep, NotificationWorkflowConfig, NotificationWorkflowRun, StepContext, StepResolver };
export default createNotificationWorkflow;
