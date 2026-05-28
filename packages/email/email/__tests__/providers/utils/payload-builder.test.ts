import { describe, expect, it } from "vitest";

import { createPayloadBuilder, PayloadBuilder } from "../../../src/providers/utils/payload-builder";

describe(PayloadBuilder, () => {
    describe("constructor", () => {
        it("should construct empty payload", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            expect(builder.build()).toStrictEqual({});
        });

        it("should construct with initial payload", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder({ foo: "bar" });

            expect(builder.build()).toStrictEqual({ foo: "bar" });
        });
    });

    describe("set", () => {
        it("should set a value", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.set("foo", "bar");

            expect(builder.build()).toStrictEqual({ foo: "bar" });
        });

        it("should skip undefined values", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.set("foo", undefined);

            expect(builder.build()).toStrictEqual({});
        });

        it("should skip null values", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.set("foo", null);

            expect(builder.build()).toStrictEqual({});
        });

        it("should be chainable", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            const result = builder.set("a", 1).set("b", 2);

            expect(result.build()).toStrictEqual({ a: 1, b: 2 });
        });
    });

    describe("setMultiple", () => {
        it("should set multiple fields", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.setMultiple({ a: 1, b: 2, c: undefined });

            expect(builder.build()).toStrictEqual({ a: 1, b: 2 });
        });
    });

    describe("addRecipients", () => {
        it("should add to/cc/bcc using formatter", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            const formatter = (addresses: any) => (Array.isArray(addresses) ? addresses.map((a) => a.email).join(",") : addresses.email);

            builder.addRecipients(
                {
                    bcc: { email: "bcc@example.com" },
                    cc: [{ email: "cc1@example.com" }, { email: "cc2@example.com" }],
                    from: { email: "sender@example.com" },
                    subject: "test",
                    to: { email: "user@example.com" },
                },
                formatter,
            );

            expect(builder.build()).toStrictEqual({
                bcc: "bcc@example.com",
                cc: "cc1@example.com,cc2@example.com",
                to: "user@example.com",
            });
        });

        it("should skip missing cc/bcc", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addRecipients(
                {
                    from: { email: "sender@example.com" },
                    subject: "test",
                    to: { email: "user@example.com" },
                },
                (addresses: any) => addresses.email,
            );

            expect(builder.build()).toStrictEqual({
                to: "user@example.com",
            });
        });
    });

    describe("addStandardFields", () => {
        it("should set subject, html, text, reply_to, replyTo", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addStandardFields({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                replyTo: { email: "reply@example.com" },
                subject: "Hi",
                text: "Hi",
                to: { email: "user@example.com" },
            });

            expect(builder.build()).toStrictEqual({
                html: "<h1>Hi</h1>",
                reply_to: { email: "reply@example.com" },
                replyTo: { email: "reply@example.com" },
                subject: "Hi",
                text: "Hi",
            });
        });
    });

    describe("addTemplateFields", () => {
        it("should add template id and data", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addTemplateFields({
                from: { email: "sender@example.com" },
                subject: "x",
                templateData: { name: "John" },
                templateId: "tpl-1",
                to: { email: "user@example.com" },
            } as any);

            expect(builder.build()).toStrictEqual({
                data: { name: "John" },
                dynamicTemplateData: { name: "John" },
                template_data: { name: "John" },
                template_id: "tpl-1",
            });
        });

        it("should support custom template key", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addTemplateFields(
                {
                    from: { email: "sender@example.com" },
                    subject: "x",
                    templateId: "tpl-2",
                    to: { email: "user@example.com" },
                } as any,
                "templateKey",
            );

            expect(builder.build()).toStrictEqual({ templateKey: "tpl-2" });
        });
    });

    describe("addSchedulingFields", () => {
        it("should add sendAt to scheduled_at and send_at", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addSchedulingFields({
                from: { email: "sender@example.com" },
                sendAt: "2026-01-01T00:00:00Z",
                subject: "x",
                to: { email: "user@example.com" },
            } as any);

            expect(builder.build()).toStrictEqual({
                scheduled_at: "2026-01-01T00:00:00Z",
                send_at: "2026-01-01T00:00:00Z",
            });
        });

        it("should skip when sendAt is missing", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addSchedulingFields({
                from: { email: "sender@example.com" },
                subject: "x",
                to: { email: "user@example.com" },
            } as any);

            expect(builder.build()).toStrictEqual({});
        });
    });

    describe("addTags", () => {
        it("should set tags in multiple formats", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addTags({
                from: { email: "sender@example.com" },
                subject: "x",
                tags: ["welcome", "user"],
                to: { email: "user@example.com" },
            });

            expect(builder.build()).toStrictEqual({
                "o:tag": ["welcome", "user"],
                Tag: "welcome",
                tags: ["welcome", "user"],
            });
        });

        it("should support custom formatter", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addTags(
                {
                    from: { email: "sender@example.com" },
                    subject: "x",
                    tags: ["a", "b"],
                    to: { email: "user@example.com" },
                },
                (tags) => tags.join("|"),
            );

            expect(builder.build().tags).toBe("a|b");
        });

        it("should skip when no tags", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addTags({
                from: { email: "sender@example.com" },
                subject: "x",
                to: { email: "user@example.com" },
            });

            expect(builder.build()).toStrictEqual({});
        });
    });

    describe("addHeaders", () => {
        it("should set headers from email options", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addHeaders({
                from: { email: "sender@example.com" },
                headers: { "X-Custom": "value" },
                subject: "x",
                to: { email: "user@example.com" },
            });

            expect(builder.build()).toStrictEqual({ headers: { "X-Custom": "value" } });
        });

        it("should run optional formatter", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addHeaders(
                {
                    from: { email: "sender@example.com" },
                    headers: { "X-Custom": "value" },
                    subject: "x",
                    to: { email: "user@example.com" },
                },
                (headers) => Object.entries(headers).map(([k, v]) => `${k}=${v}`),
            );

            expect(builder.build()).toStrictEqual({ headers: ["X-Custom=value"] });
        });

        it("should skip when no headers", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addHeaders({
                from: { email: "sender@example.com" },
                subject: "x",
                to: { email: "user@example.com" },
            });

            expect(builder.build()).toStrictEqual({});
        });
    });

    describe("addBatchId", () => {
        it("should add batchId if present", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addBatchId({
                batchId: "batch-1",
                from: { email: "sender@example.com" },
                subject: "x",
                to: { email: "user@example.com" },
            } as any);

            expect(builder.build()).toStrictEqual({ batch_id: "batch-1" });
        });

        it("should skip when batchId is missing", () => {
            expect.assertions(1);

            const builder = new PayloadBuilder();

            builder.addBatchId({
                from: { email: "sender@example.com" },
                subject: "x",
                to: { email: "user@example.com" },
            } as any);

            expect(builder.build()).toStrictEqual({});
        });
    });

    describe("createPayloadBuilder", () => {
        it("should create a new PayloadBuilder instance", () => {
            expect.assertions(2);

            const builder = createPayloadBuilder({ initial: "value" });

            expect(builder).toBeInstanceOf(PayloadBuilder);
            expect(builder.build()).toStrictEqual({ initial: "value" });
        });

        it("should default to empty initial payload", () => {
            expect.assertions(1);

            const builder = createPayloadBuilder();

            expect(builder.build()).toStrictEqual({});
        });
    });
});
