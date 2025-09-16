import { expect, test } from "@playwright/test";

test.describe("Error Overlay E2E Tests", () => {
    test.describe("Basic Error Display", () => {
        test.skip("should display overlay for runtime errors", async ({ page }) => {
            await page.goto("/");

            // Trigger a runtime error
            await page.evaluate(() => {
                // @ts-ignore - intentional error for testing
                throw new Error("This is a test runtime error");
            });

            // Wait for overlay to appear
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Verify overlay is visible
            const overlay = page.locator("#__flame__overlay");

            await expect(overlay).toBeVisible();

            // Verify error message is displayed
            const errorMessage = page.locator("#__flame__heading");

            await expect(errorMessage).toContainText("Runtime Error");
        });

        test.skip("should display original source locations", async ({ page }) => {
            await page.goto("/");

            // Trigger an error with source location
            await page.evaluate(() => {
                // Error from a specific line - this should show original source location
                throw new Error("Source location test error");
            });

            // Wait for overlay
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Check if file path is displayed and contains original source path
            const fileLink = page.locator("#__flame__filelink");
            const fileLinkText = await fileLink.textContent();

            // Should show original source path, not compiled path
            expect(fileLinkText).toMatch(/\.tsx?:\d+/); // Should show .tsx or .ts with line number
            expect(fileLinkText).not.toContain("vite");
            expect(fileLinkText).not.toContain("node_modules");
        });
    });

    test.describe("Cause Chain Handling", () => {
        test("should display errors with cause chains", async ({ page }) => {
            await page.goto("/error-test");

            // Wait for page to load and trigger error with cause chain
            await page.waitForSelector("[data-error-trigger]", { timeout: 5000 });

            // Click button to trigger error with cause chain
            await page.click("[data-error-trigger]");

            // Wait for overlay
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Verify multiple errors are shown
            const errorCount = page.locator("[data-flame-dialog-error-index]");

            await expect(errorCount).toBeVisible();

            // Check if navigation controls are present
            const nextButton = page.locator("[data-flame-dialog-error-next]");
            const previousButton = page.locator("[data-flame-dialog-error-previous]");

            // Should have navigation for multiple errors
            await expect(nextButton).toBeVisible();
            await expect(previousButton).toBeVisible();
        });

        test("should navigate through cause chain", async ({ page }) => {
            await page.goto("/cause-chain-test");

            // Trigger error with cause chain
            await page.click("[data-error-trigger]");
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Get initial error index
            const initialIndex = await page.locator("[data-flame-dialog-error-index]").textContent();

            // Navigate to next error
            await page.click("[data-flame-dialog-error-next]");

            // Verify index changed
            const newIndex = await page.locator("[data-flame-dialog-error-index]").textContent();

            expect(newIndex).not.toBe(initialIndex);

            // Navigate back
            await page.click("[data-flame-dialog-error-previous]");
            const backIndex = await page.locator("[data-flame-dialog-error-index]").textContent();

            expect(backIndex).toBe(initialIndex);
        });

        test("should display original source locations for all causes", async ({ page }) => {
            await page.goto("/cause-chain-test");

            // Trigger error with cause chain
            await page.click("[data-error-trigger]");
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Check first error
            let fileLink = page.locator("#__flame__filelink");
            let fileLinkText = await fileLink.textContent();

            expect(fileLinkText).toMatch(/\.tsx?:\d+/);
            expect(fileLinkText).not.toContain("vite");
            expect(fileLinkText).not.toContain("node_modules");

            // Navigate to second error
            await page.click("[data-flame-dialog-error-next]");

            // Wait for content to update
            await page.waitForTimeout(100);

            // Check second error also has original source location
            fileLink = page.locator("#__flame__filelink");
            fileLinkText = await fileLink.textContent();

            expect(fileLinkText).toMatch(/\.tsx?:\d+/);
            expect(fileLinkText).not.toContain("vite");
            expect(fileLinkText).not.toContain("node_modules");
        });
    });

    test.describe("Code Frame Display", () => {
        test.skip("should display code frames for original source", async ({ page }) => {
            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("Code frame test error");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Check if code frame is displayed
            const overlay = page.locator("#__flame__overlay");
            const overlayContent = await overlay.textContent();

            // Should contain some code-like content
            expect(overlayContent?.length).toBeGreaterThan(10);
        });

        test.skip("should switch between original and compiled views", async ({ page }) => {
            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("View switching test error");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Check if mode switching buttons are present
            const originalButton = page.locator("[data-flame-mode='original']");
            const compiledButton = page.locator("[data-flame-mode='compiled']");

            // Should have both buttons if both views are available
            const originalVisible = await originalButton.isVisible().catch(() => false);
            const compiledVisible = await compiledButton.isVisible().catch(() => false);

            if (originalVisible && compiledVisible) {
                // Test switching between modes
                await originalButton.click();
                await page.waitForTimeout(100);

                await compiledButton.click();
                await page.waitForTimeout(100);

                // Should still have content
                const overlay = page.locator("#__flame__overlay");
                const overlayContent = await overlay.textContent();

                expect(overlayContent?.length).toBeGreaterThan(0);
            }
        });
    });

    test.describe("Stack Trace Display", () => {
        test.skip("should display readable stack traces", async ({ page }) => {
            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("Stack trace test error");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Check if stack trace is displayed
            const stackTrace = page.locator("#__flame__stacktrace");

            await expect(stackTrace).toBeVisible();

            // Should contain stack trace content
            const stackContent = await stackTrace.textContent();

            expect(stackContent).toContain("at");
            expect(stackContent?.length).toBeGreaterThan(20);
        });

        test.skip("should have clickable stack trace links", async ({ page }) => {
            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("Clickable stack trace test");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Check for clickable stack links
            const stackLinks = page.locator("#__flame__stacktrace .stack-link");
            const linkCount = await stackLinks.count();

            if (linkCount > 0) {
                // Click first stack link
                await stackLinks.first().click();

                // Should not throw error (basic functionality test)
                // In a real scenario, this would open the file in editor
            }
        });
    });

    test.describe("Error Overlay UI", () => {
        test.skip("should be closable", async ({ page }) => {
            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("Closable test error");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Verify overlay is visible
            const overlay = page.locator("#__flame__overlay");

            await expect(overlay).toBeVisible();

            // Click close button
            const closeButton = page.locator("#__flame__close");

            await closeButton.click();

            // Wait for overlay to disappear
            await page.waitForSelector("#__flame__overlay", { state: "hidden", timeout: 5000 });

            // Verify overlay is gone
            await expect(overlay).not.toBeVisible();
        });

        test.skip("should close on ESC key", async ({ page }) => {
            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("ESC close test error");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Press ESC key
            await page.keyboard.press("Escape");

            // Wait for overlay to disappear
            await page.waitForSelector("#__flame__overlay", { state: "hidden", timeout: 5000 });

            // Verify overlay is gone
            const overlay = page.locator("#__flame__overlay");

            await expect(overlay).not.toBeVisible();
        });
    });

    test.describe("Cross-browser Compatibility", () => {
        test.skip("should work in Chrome", async ({ browserName, page }) => {
            test.skip(browserName !== "chromium", "Chrome-specific test");

            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("Chrome compatibility test");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Verify overlay works in Chrome
            const overlay = page.locator("#__flame__overlay");

            await expect(overlay).toBeVisible();
        });

        test.skip("should work in Firefox", async ({ browserName, page }) => {
            test.skip(browserName !== "firefox", "Firefox-specific test");

            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("Firefox compatibility test");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Verify overlay works in Firefox
            const overlay = page.locator("#__flame__overlay");

            await expect(overlay).toBeVisible();
        });

        test.skip("should work in Safari", async ({ browserName, page }) => {
            test.skip(browserName !== "webkit", "Safari-specific test");

            await page.goto("/");

            // Trigger error
            await page.evaluate(() => {
                throw new Error("Safari compatibility test");
            });

            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Verify overlay works in Safari
            const overlay = page.locator("#__flame__overlay");

            await expect(overlay).toBeVisible();
        });
    });
});
