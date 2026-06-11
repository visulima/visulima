import { describe, expect, it } from "vitest";

import {
    buildListUnsubscribe,
    createSuppressionStore,
    filterSuppressed,
    MemorySuppressionStore,
    parseArfReport,
    parseListUnsubscribe,
} from "../../src/deliverability";

describe("deliverability", () => {
    describe(buildListUnsubscribe, () => {
        it("builds combined url + mailto targets", () => {
            expect.assertions(1);

            const headers = buildListUnsubscribe({ mailto: "unsub@example.com", url: "https://example.com/u?id=1" });

            expect(headers["List-Unsubscribe"]).toBe("<https://example.com/u?id=1>, <mailto:unsub@example.com?subject=unsubscribe>");
        });

        it("emits the RFC 8058 one-click post header", () => {
            expect.assertions(1);

            const headers = buildListUnsubscribe({ oneClick: true, url: "https://example.com/u?id=1" });

            expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
        });

        it("preserves a full mailto URI as-is", () => {
            expect.assertions(1);

            const headers = buildListUnsubscribe({ mailto: "mailto:unsub@example.com?subject=stop&body=remove" });

            expect(headers["List-Unsubscribe"]).toBe("<mailto:unsub@example.com?subject=stop&body=remove>");
        });

        it("throws when neither url nor mailto is given", () => {
            expect.assertions(1);
            expect(() => buildListUnsubscribe({})).toThrow("at least one of");
        });

        it("throws when one-click is requested without an https url", () => {
            expect.assertions(1);
            expect(() => buildListUnsubscribe({ mailto: "unsub@example.com", oneClick: true })).toThrow("RFC 8058");
        });
    });

    describe(parseListUnsubscribe, () => {
        it("extracts targets", () => {
            expect.assertions(1);

            const targets = parseListUnsubscribe("<https://example.com/u>, <mailto:unsub@example.com?subject=unsubscribe>");

            expect(targets).toStrictEqual(["https://example.com/u", "mailto:unsub@example.com?subject=unsubscribe"]);
        });
    });

    describe(MemorySuppressionStore, () => {
        it("suppresses, looks up, lists and removes addresses (case-insensitively)", () => {
            expect.assertions(5);

            const store = new MemorySuppressionStore();

            store.add("User@Example.com", "bounce", { type: "hard" });

            expect(store.has("user@example.com")).toBe(true);
            expect(store.get("user@example.com")?.reason).toBe("bounce");
            expect(store.size).toBe(1);
            expect(store.remove("USER@example.com")).toBe(true);
            expect(store.has("user@example.com")).toBe(false);
        });

        it("seeds from an initial iterable via the factory", () => {
            expect.assertions(1);

            const store = createSuppressionStore([{ address: "a@b.com", reason: "complaint" }]);

            expect(store.has("a@b.com")).toBe(true);
        });
    });

    describe(filterSuppressed, () => {
        it("partitions recipients into allowed and suppressed", async () => {
            expect.assertions(2);

            const store = new MemorySuppressionStore([{ address: "blocked@example.com", reason: "unsubscribe" }]);

            const result = await filterSuppressed([{ email: "ok@example.com" }, { email: "Blocked@example.com", name: "Blocked" }], store);

            expect(result.allowed).toStrictEqual([{ email: "ok@example.com" }]);
            expect(result.suppressed).toStrictEqual([{ email: "Blocked@example.com", name: "Blocked" }]);
        });
    });

    describe(parseArfReport, () => {
        it("parses a feedback-report section", () => {
            expect.assertions(3);

            const raw = [
                "Content-Type: multipart/report; report-type=feedback-report; boundary=\"b\"",
                "",
                "--b",
                "Content-Type: message/feedback-report",
                "",
                "Feedback-Type: abuse",
                "User-Agent: SomeFBL/1.0",
                "Version: 1",
                "Original-Mail-From: bounce@sender.example",
                "Original-Rcpt-To: complainer@isp.example",
                "Reported-Domain: sender.example",
                "Source-IP: 192.0.2.1",
                "",
                "--b--",
            ].join("\r\n");

            const report = parseArfReport(raw);

            expect(report.feedbackType).toBe("abuse");
            expect(report.originalRcptTo).toBe("complainer@isp.example");
            expect(report.sourceIp).toBe("192.0.2.1");
        });
    });
});
