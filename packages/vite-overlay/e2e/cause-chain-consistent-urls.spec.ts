import { expect, test } from "@playwright/test";
import { expect, it } from "vitest";

test.describe("Cause Chain Error URL Consistency", () => {
    test.describe("Error with cause chain should show consistent URLs", () => {
        it("should display both errors with consistent HTTP URLs", async ({ page }) => {
            // Navigate to the error test page
            await page.goto("/error-test");

            // Click the cause chain button
            await page.click("[data-error-trigger]");

            // Wait for overlay to appear
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            // Verify overlay is visible
            const overlay = page.locator("#__v_o__overlay");

            await expect(overlay).toBeVisible();

            // Check that both errors are displayed
            const errorItems = page.locator("#__v_o__errors .error-item");

            await expect(errorItems).toHaveCount(2);

            // Verify both errors have consistent HTTP URLs
            const firstError = errorItems.nth(0);
            const secondError = errorItems.nth(1);

            // Check first error (primary)
            const firstFileLink = firstError.locator("#__v_o__filelink");
            const firstFileText = await firstFileLink.textContent();

            expect(firstFileText).toMatch(/^http:\/\/localhost:5173\//);
            expect(firstFileText).not.toContain("file://");
            expect(firstFileText).not.toMatch(/^\//); // Should not start with just /

            // Check second error (cause)
            const secondFileLink = secondError.locator("#__v_o__filelink");
            const secondFileText = await secondFileLink.textContent();

            expect(secondFileText).toMatch(/^http:\/\/localhost:5173\//);
            expect(secondFileText).not.toContain("file://");
            expect(secondFileText).not.toMatch(/^\//);

            // Both should have the same base URL structure
            const firstBaseUrl = `${firstFileText?.split(":")[0]}://${firstFileText?.split(":")[1]?.split("/")[0]}`;
            const secondBaseUrl = `${secondFileText?.split(":")[0]}://${secondFileText?.split(":")[1]?.split("/")[0]}`;

            expect(firstBaseUrl).toBe(secondBaseUrl);
        });

        it("should show correct compiled code frames for both errors", async ({ page }) => {
            await page.goto("/error-test");

            // Click the cause chain button
            await page.click("[data-error-trigger]");

            // Wait for overlay
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            const errorItems = page.locator("#__v_o__errors .error-item");

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

        it("should handle errors without cause chain gracefully", async ({ page }) => {
            await page.goto("/error-test");

            // Click the simple error button
            await page.click("[data-testid='simple-error-btn']");

            // Wait for overlay
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            // Should still work and show HTTP URL
            const fileLink = page.locator("#__v_o__filelink");
            const fileText = await fileLink.textContent();

            expect(fileText).toMatch(/^http:\/\/localhost:5173\//);
        });

        it("should handle malformed stack traces gracefully", async ({ page }) => {
            await page.goto("/error-test");

            // Click the complex error button which creates a complex nested structure
            await page.click("[data-testid='complex-error-btn']");

            // Wait for overlay
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            // Should not crash and should still show overlay
            const overlay = page.locator("#__v_o__overlay");

            await expect(overlay).toBeVisible();

            // Should have fallback behavior
            const fileLink = page.locator("#__v_o__filelink");
            const fileText = await fileLink.textContent();

            // Should either show HTTP URL or fallback gracefully
            if (fileText) {
                expect(fileText).not.toContain("file://");
            }
        });
    });
});
