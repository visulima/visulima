import { expect, test } from "@playwright/test";

test.describe("Cause Chain Error URL Consistency", () => {
    test.describe("Error with cause chain should show consistent URLs", () => {
        test("should display both errors with consistent HTTP URLs", async ({ page }) => {
            await page.goto("/");

            // Navigate to the error test page
            await page.goto("/error-test");

            // Trigger an error with cause chain
            await page.evaluate(() => {
                const primaryError = new Error("Primary error message");

                // Create a cause error that will have a different stack trace
                const causeError = new Error("Cause error message");
                primaryError.cause = causeError;

                throw primaryError;
            });

            // Wait for overlay to appear
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Verify overlay is visible
            const overlay = page.locator("#__flame__overlay");
            await expect(overlay).toBeVisible();

            // Check that both errors are displayed
            const errorItems = page.locator("#__flame__errors .error-item");
            await expect(errorItems).toHaveCount(2);

            // Verify both errors have consistent HTTP URLs
            const firstError = errorItems.nth(0);
            const secondError = errorItems.nth(1);

            // Check first error (primary)
            const firstFileLink = firstError.locator("#__flame__filelink");
            const firstFileText = await firstFileLink.textContent();
            expect(firstFileText).toMatch(/^http:\/\/localhost:5173\//);
            expect(firstFileText).not.toContain("file://");
            expect(firstFileText).not.toMatch(/^\//); // Should not start with just /

            // Check second error (cause)
            const secondFileLink = secondError.locator("#__flame__filelink");
            const secondFileText = await secondFileLink.textContent();
            expect(secondFileText).toMatch(/^http:\/\/localhost:5173\//);
            expect(secondFileText).not.toContain("file://");
            expect(secondFileText).not.toMatch(/^\//);

            // Both should have the same base URL structure
            const firstBaseUrl = firstFileText?.split(':')[0] + '://' + firstFileText?.split(':')[1]?.split('/')[0];
            const secondBaseUrl = secondFileText?.split(':')[0] + '://' + secondFileText?.split(':')[1]?.split('/')[0];
            expect(firstBaseUrl).toBe(secondBaseUrl);
        });

        test("should show correct compiled code frames for both errors", async ({ page }) => {
            await page.goto("/error-test");

            // Trigger an error with cause chain
            await page.evaluate(() => {
                const primaryError = new Error("Primary error message");

                const causeError = new Error("Cause error message");
                primaryError.cause = causeError;

                throw primaryError;
            });

            // Wait for overlay
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            const errorItems = page.locator("#__flame__errors .error-item");

            // Check first error compiled code frame
            const firstError = errorItems.nth(0);
            const firstCompiledFrame = firstError.locator(".compiled-code-frame");
            await expect(firstCompiledFrame).toBeVisible();

            // Should contain actual compiled code, not fallback text
            const firstFrameText = await firstCompiledFrame.textContent();
            expect(firstFrameText).toContain("function"); // Should show actual compiled function
            expect(firstFrameText).not.toContain("Error at line"); // Should not show fallback

            // Check second error compiled code frame
            const secondError = errorItems.nth(1);
            const secondCompiledFrame = secondError.locator(".compiled-code-frame");
            await expect(secondCompiledFrame).toBeVisible();

            // Should contain actual compiled code
            const secondFrameText = await secondCompiledFrame.textContent();
            expect(secondFrameText).toContain("function"); // Should show actual compiled function
            expect(secondFrameText).not.toContain("Error at line"); // Should not show fallback
        });

        test("should handle errors without cause chain gracefully", async ({ page }) => {
            await page.goto("/error-test");

            // Trigger a simple error without cause chain
            await page.evaluate(() => {
                throw new Error("Simple error without cause");
            });

            // Wait for overlay
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Should still work and show HTTP URL
            const fileLink = page.locator("#__flame__filelink");
            const fileText = await fileLink.textContent();
            expect(fileText).toMatch(/^http:\/\/localhost:5173\//);
        });

        test("should handle malformed stack traces gracefully", async ({ page }) => {
            await page.goto("/error-test");

            // Create an error with malformed stack trace
            await page.evaluate(() => {
                const error = new Error("Malformed stack error");
                error.stack = "Invalid stack trace format";
                throw error;
            });

            // Wait for overlay
            await page.waitForSelector("#__flame__overlay", { timeout: 5000 });

            // Should not crash and should still show overlay
            const overlay = page.locator("#__flame__overlay");
            await expect(overlay).toBeVisible();

            // Should have fallback behavior
            const fileLink = page.locator("#__flame__filelink");
            const fileText = await fileLink.textContent();

            // Should either show HTTP URL or fallback gracefully
            if (fileText) {
                expect(fileText).not.toContain("file://");
            }
        });
    });
});
