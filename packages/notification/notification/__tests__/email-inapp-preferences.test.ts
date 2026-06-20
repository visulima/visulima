import { describe, expect, it, vi } from "vitest";

import { emailChannel } from "../src/channels/email";
import type { InAppStore } from "../src/channels/inapp";
import { inAppProvider } from "../src/channels/inapp";
import { createNotification } from "../src/notification";
import { MemoryPreferenceStore, preferencesGate } from "../src/preferences";
import { route } from "../src/routing";

describe("email channel adapter", () => {
    it("delegates to a @visulima/email Mail instance and maps the result", async () => {
        expect.assertions(3);

        const mail = {
            send: vi.fn().mockResolvedValue({ data: { messageId: "eml-1", provider: "resend", sent: true, timestamp: new Date() }, success: true }),
        };

        const notify = createNotification({ email: emailChannel(mail) });
        const receipt = await notify.sendToChannel("email", { from: "a@x.com", html: "<p>hi</p>", subject: "Hi", to: "b@x.com" });

        expect(receipt.successful).toBe(true);
        expect(receipt.successful ? receipt.messageId : "").toBe("eml-1");
        expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ subject: "Hi", to: "b@x.com" }));
    });

    it("returns a failed receipt when the mail send fails", async () => {
        expect.assertions(1);

        const mail = { send: vi.fn().mockResolvedValue({ error: new Error("smtp down"), success: false }) };
        const notify = createNotification({ email: emailChannel(mail) });
        const receipt = await notify.sendToChannel("email", { subject: "Hi", to: "b@x.com" });

        expect(receipt.successful).toBe(false);
    });
});

describe("in-app channel", () => {
    it("persists notifications to the store and exposes unread count", async () => {
        expect.assertions(3);

        const provider = inAppProvider();
        const notify = createNotification({ inapp: provider });

        await notify.sendToChannel("inapp", { body: "Welcome", title: "Hi", to: "user-1" });
        await notify.sendToChannel("inapp", { body: "Second", to: "user-1" });

        const store = provider.getInstance?.() as InAppStore;

        await expect(store.unreadCount("user-1")).resolves.toBe(2);

        const list = await store.list("user-1");

        expect(list).toHaveLength(2);

        await store.markAllRead("user-1");

        await expect(store.unreadCount("user-1")).resolves.toBe(0);
    });
});

describe("preferences", () => {
    it("gate blocks opted-out channels but allows critical sends", async () => {
        expect.assertions(2);

        const prefs = new MemoryPreferenceStore();

        prefs.set("+1", { channels: { sms: false } });

        const notify = createNotification({ sms: inAppProvider() as never });

        const blocked = await route(notify, { sms: { text: "hi", to: "+1" } }, { gate: preferencesGate(prefs) });

        expect(blocked).toHaveLength(0);

        const critical = await route(notify, { sms: { text: "hi", to: "+1" } }, { gate: preferencesGate(prefs, { critical: true }) });

        expect(critical).toHaveLength(1);
    });
});
