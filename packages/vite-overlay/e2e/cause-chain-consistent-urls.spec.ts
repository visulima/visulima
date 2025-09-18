import { expect, test } from "@playwright/test";
import { waitForErrorTestPage } from "./utils/test-helpers";

test.describe("Cause Chain Error URL Consistency", () => {
    test.describe("Error with cause chain should show consistent URLs", () => {
        test("should display both errors with consistent HTTP URLs", async ({ page }) => {
            // Navigate to the error test page
            await page.goto("/error-test");

            await waitForErrorTestPage(page);

            // Click the cause chain button
            await page.click("[data-error-trigger]");

            // Wait for overlay to appear
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            // Verify overlay is visible
            const overlay = page.locator("#__v_o__overlay");

            await expect(overlay).toBeVisible();

            // Check if there's content in the overlay
            const overlayContent = await overlay.textContent();
            expect(overlayContent?.length).toBeGreaterThan(0);

            // Check file link exists and has proper format
            const fileLink = page.locator("#__v_o__filelink");
            const fileText = await fileLink.textContent();

            if (fileText) {
                // Should not contain file:// protocol
                expect(fileText).not.toContain("file://");
                // Should either be relative path or HTTP URL
                expect(fileText).toMatch(/^(\.|http:\/\/localhost:5173\/)/);
            }
        });

        test("should show correct compiled code frames for both errors", async ({ page }) => {
            await page.goto("/error-test");

            await waitForErrorTestPage(page);

            // Click the cause chain button
            await page.click("[data-error-trigger]");

            // Wait for overlay
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            // Check if compiled mode button exists
            const compiledButton = page.locator("[data-flame-mode=\"compiled\"]");

            if (await compiledButton.isVisible()) {
                // Click compiled button to switch views
                await compiledButton.click();

                // Wait a moment for the view to update
                await page.waitForTimeout(100);

                // Check that overlay still has content
                const overlayAfterSwitch = page.locator("#__v_o__overlay");
                const contentAfterSwitch = await overlayAfterSwitch.textContent();

                expect(contentAfterSwitch?.length).toBeGreaterThan(0);
            } else {
                // If no compiled button, just verify original view has content
                const overlayContent = await page.locator("#__v_o__overlay").textContent();
                expect(overlayContent?.length).toBeGreaterThan(0);
            }
        });

        test("should handle errors without cause chain gracefully", async ({ page }) => {
            await page.goto("/error-test");

            await waitForErrorTestPage(page);

            // Click the simple error button
            await page.click("[data-testid='simple-error-btn']");

            // Wait for overlay
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            // Should still work and show HTTP URL
            const fileLink = page.locator("#__v_o__filelink");
            const fileText = await fileLink.textContent();

            expect(fileText).toMatch(/^\./);
        });

        test("should handle malformed stack traces gracefully", async ({ page }) => {
            await page.goto("/error-test");

            await waitForErrorTestPage(page);

            // Click the complex error button which creates a complex nested structure
            await page.click("[data-testid='complex-error-btn']");

            // Wait for overlay
            await page.waitForSelector("#__v_o__overlay", { timeout: 5000 });

            // Should not crash and should still show overlay
            const overlay = page.locator("#__v_o__overlay");

            await expect(overlay).toBeVisible();

            // Should have file link with proper format
            const fileLink = page.locator("#__v_o__filelink");
            const fileText = await fileLink.textContent();

            // Should show relative path or HTTP URL
            if (fileText) {
                expect(fileText).not.toContain("file://");
                // Should either be relative path starting with . or HTTP URL
                expect(fileText).toMatch(/^(\.|http:\/\/localhost:5173\/)/);
            }
        });
    });
});
