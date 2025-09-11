import { describe, expect, it } from "vitest";

import copyButton from "../src/error-inspector/components/copy-button";
import copyDropdown from "../src/error-inspector/components/copy-dropdown";
import { headerTabs } from "../src/error-inspector/components/header-tabs";
import rawStackTrace from "../src/error-inspector/components/raw-stack-trace";
import shortcutsButton from "../src/error-inspector/components/shortcuts-button";
import tooltip from "../src/error-inspector/components/tooltip";

describe("components", () => {
    describe("copyButton", () => {
        it("should generate copy button HTML", () => {
            const html = copyButton({
                label: "Copy text",
                targetId: "test-target",
            });

            expect(html).toContain('type="button"');
            expect(html).toContain('aria-label="Copy text"');
            expect(html).toContain('data-target="#test-target"');
            expect(html).toContain("Copy text");
        });

        it("should handle custom success text", () => {
            const html = copyButton({
                label: "Copy",
                successText: "Done!",
                targetId: "target",
            });

            expect(html).toContain('data-success-text="Done!"');
        });

        it("should use default values when not provided", () => {
            const html = copyButton({
                targetId: "target",
            });

            expect(html).toContain('aria-label="Copy"');
            expect(html).toContain('data-success-text="Copied!"');
        });
    });

    describe("copyDropdown", () => {
        it("should generate copy dropdown HTML", () => {
            const html = copyDropdown({
                label: "Copy",
                secondaryLabel: "Copy with AI prompt",
                secondaryText: "AI prompt content",
                targetId: "test-target",
            });

            expect(html).toContain("ono-dropdown");
            expect(html).toContain('data-target="#test-target"');
            expect(html).toContain("Copy");
            expect(html).toContain("Copy with AI prompt");
        });

        it("should handle secondary text", () => {
            const html = copyDropdown({
                label: "Copy",
                secondaryLabel: "Copy prompt",
                secondaryText: "Custom AI prompt",
                targetId: "target",
            });

            expect(html).toContain('data-text="Custom AI prompt"');
        });
    });

    describe("headerTabs", () => {
        it("should generate header tabs HTML", () => {
            const tabs = [
                { id: "stack", name: "Stack", selected: true },
                { id: "context", name: "Context", selected: false },
            ];

            const html = headerTabs(tabs);

            expect(html).toContain('role="tablist"');
            expect(html).toContain('data-ono-tab="#ono-section-stack"');
            expect(html).toContain('data-ono-tab="#ono-section-context"');
            expect(html).toContain('aria-selected="true"');
            expect(html).toContain('aria-selected="false"');
        });

        it("should handle custom icons", () => {
            const tabs = [
                { id: "custom", name: "Custom", icon: "custom-icon" },
            ];

            const html = headerTabs(tabs);

            expect(html).toContain("custom-icon");
        });

        it("should use default icons for known tab types", () => {
            const tabs = [
                { id: "stack", name: "Stack" },
                { id: "context", name: "Context" },
            ];

            const html = headerTabs(tabs);

            expect(html).toContain("layers"); // stack icon
            expect(html).toContain("blocks"); // context icon
        });
    });

    describe("rawStackTrace", () => {
        it("should generate raw stack trace HTML", () => {
            const stack = "Error: Test error\n    at test (/file.js:1:1)";
            const html = rawStackTrace(stack);

            expect(html).toContain("Stack Trace");
            expect(html).toContain("Test error");
            expect(html).toContain("/file.js:1:1");
        });

        it("should handle undefined stack", () => {
            const html = rawStackTrace(undefined);

            expect(html).toContain("Stack Trace");
            expect(html).toBeDefined();
        });

        it("should sanitize HTML in stack trace", () => {
            const maliciousStack = "Error: <script>alert('xss')</script>\n    at test (/file.js:1:1)";
            const html = rawStackTrace(maliciousStack);

            expect(html).not.toContain("<script>");
        });
    });

    describe("shortcutsButton", () => {
        it("should generate shortcuts button HTML", () => {
            const html = shortcutsButton();

            expect(html).toContain('type="button"');
            expect(html).toContain('aria-label="Open keyboard shortcuts"');
            expect(html).toContain('onclick="showShortcutsModal()"');
            expect(html).toContain("Keyboard shortcuts");
        });
    });

    describe("tooltip", () => {
        it("should generate tooltip HTML", () => {
            const html = tooltip({
                message: "This is a helpful tip",
            });

            expect(html).toContain('title="This is a helpful tip"');
            expect(html).toContain("cursor-help");
        });

        it("should handle undefined message", () => {
            const html = tooltip();
            expect(html).toBe("");
        });

        it("should sanitize HTML in tooltip message", () => {
            const html = tooltip({
                message: 'Tip with <script>alert("xss")</script>',
            });

            expect(html).not.toContain("<script>");
        });
    });
});
