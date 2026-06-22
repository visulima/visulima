import { createRuntime } from "@visulima/workflow";
import { describe, expect, it } from "vitest";

import { createNotification } from "../src/notification";
import type { MockProviderInstance } from "../src/providers/mock";
import { mockProvider } from "../src/providers/mock";
import createNotificationWorkflow from "../src/workflow/create-notification-workflow";

const buildNotify = () => {
    const notification = createNotification({
        email: mockProvider({ channel: "email", id: "email-mock" }),
        sms: mockProvider({ channel: "sms", id: "sms-mock" }),
    });

    const sent = (channel: "email" | "sms") => (notification.getProvider(channel)?.getInstance() as MockProviderInstance).sent;

    return { notification, sent };
};

describe(createNotificationWorkflow, () => {
    it("delivers channel steps, suspends on delay, and resumes once without re-sending", async () => {
        expect.assertions(6);

        const { notification, sent } = buildNotify();
        const workflow = createNotificationWorkflow<{ to: string }>(notification, {
            id: "welcome",
            run: async ({ payload, step }) => {
                const sms = { text: "hi", to: payload.to };
                const email = { from: "a@b.com", html: "<p>hi</p>", subject: "Hi", to: payload.to };

                await step.sms("hello", () => sms);
                await step.delay("wait", 1000);
                await step.email("follow-up", () => email);
            },
        });

        const runtime = createRuntime({ workflows: [workflow] });
        const triggered = await runtime.trigger(workflow, { to: "+15555550100" });

        expect(triggered.status).toBe("suspended");
        expect(sent("sms")).toHaveLength(1);
        expect(sent("email")).toHaveLength(0);

        const [resumed] = await runtime.sweep(Date.now() + 2000);

        expect(resumed?.status).toBe("completed");
        expect(sent("email")).toHaveLength(1);
        // The pre-delay SMS step must not re-send on replay.
        expect(sent("sms")).toHaveLength(1);
    });

    it("skips a step whose skip predicate returns true", async () => {
        expect.assertions(2);

        const { notification, sent } = buildNotify();
        const workflow = createNotificationWorkflow<{ to: string }>(notification, {
            id: "skipper",
            run: async ({ payload, step }) => {
                const message = { text: "x", to: payload.to };

                await step.sms("maybe", () => message, { skip: () => true });
            },
        });

        const runtime = createRuntime({ workflows: [workflow] });
        const result = await runtime.trigger(workflow, { to: "+15555550100" });

        expect(result.status).toBe("completed");
        expect(sent("sms")).toHaveLength(0);
    });

    it("returns the workflow output and exposes receipts via custom steps", async () => {
        expect.assertions(2);

        const { notification, sent } = buildNotify();
        const workflow = createNotificationWorkflow<{ to: string }, string>(notification, {
            id: "with-output",
            run: async ({ payload, step }) => {
                const message = { text: "hi", to: payload.to };
                const receipt = await step.sms("notify", () => message);

                return receipt?.successful ? "ok" : "failed";
            },
        });

        const runtime = createRuntime({ workflows: [workflow] });
        const result = await runtime.trigger(workflow, { to: "+15555550100" });

        expect(result.output).toBe("ok");
        expect(sent("sms")).toHaveLength(1);
    });

    it("records a failed send as completed by default (failure does not throw)", async () => {
        expect.assertions(1);

        const notification = createNotification({ sms: mockProvider({ channel: "sms", failWith: "provider down", id: "sms-mock" }) });
        const workflow = createNotificationWorkflow<{ to: string }>(notification, {
            id: "best-effort",
            run: async ({ payload, step }) => {
                const message = { text: "hi", to: payload.to };

                await step.sms("notify", () => message);
            },
        });

        const runtime = createRuntime({ workflows: [workflow] });
        const result = await runtime.trigger(workflow, { to: "+15555550100" });

        expect(result.status).toBe("completed");
    });

    it("fails the run when a send fails and throwOnFailure is set", async () => {
        expect.assertions(2);

        const notification = createNotification({ sms: mockProvider({ channel: "sms", failWith: "provider down", id: "sms-mock" }) });
        const workflow = createNotificationWorkflow<{ to: string }>(notification, {
            id: "must-deliver",
            run: async ({ payload, step }) => {
                const message = { text: "hi", to: payload.to };

                await step.sms("critical", () => message, { throwOnFailure: true });
            },
        });

        const runtime = createRuntime({ workflows: [workflow] });
        const result = await runtime.trigger(workflow, { to: "+15555550100" });

        expect(result.status).toBe("failed");
        expect(result.error?.message).toContain("provider down");
    });
});
