import { expect, test } from "@playwright/test";

import { waitForErrorOverlay, waitForErrorTestPage } from "./utils/test-helpers";

test.describe("Balloon Customization", () => {
    test("should display balloon button by default", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Check if balloon exists (it might be hidden if no errors)
        const balloon = page.locator("#__v_o__balloon");

        // Balloon should exist in the DOM
        await expect(balloon).toHaveCount(1);
    });

    test("should show balloon count when errors occur", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Trigger an error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Check balloon count
        const balloonCount = page.locator("#__v_o__balloon_count");

        await expect(balloonCount).toBeVisible();

        const countText = await balloonCount.textContent();

        expect(Number.parseInt(countText || "0", 10)).toBeGreaterThan(0);
    });

    test("should toggle overlay when balloon is clicked", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Trigger an error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Close overlay first
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);

        // Click balloon to reopen
        const balloon = page.locator("#__v_o__balloon");

        await balloon.click();
        await page.waitForTimeout(500);

        // Overlay should be visible again
        const overlay = page.locator("#__v_o__root");

        await expect(overlay).toBeVisible();
    });

    test("should expose global overlay API", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Check if API exists
        const apiExists = await page.evaluate(() => globalThis.__visulima_overlay__ !== undefined);

        expect(apiExists).toBe(true);

        // Check if sendError method exists
        const hasSendError = await page.evaluate(() => typeof globalThis.__visulima_overlay__?.sendError === "function");

        expect(hasSendError).toBe(true);
    });

    test("should have open and close methods in API", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Trigger an error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Close overlay
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);

        // Use API to open
        await page.evaluate(() => {
            globalThis.__visulima_overlay__?.open();
        });

        await page.waitForTimeout(500);

        // Overlay should be visible
        const overlay = page.locator("#__v_o__root");

        await expect(overlay).toBeVisible();

        // Use API to close
        await page.evaluate(() => {
            globalThis.__visulima_overlay__?.close();
        });

        await page.waitForTimeout(500);

        // Overlay should be hidden
        await expect(overlay).not.toBeVisible();
    });

    test("should have getInstance method in API", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Trigger an error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Check getInstance
        const instance = await page.evaluate(() => globalThis.__visulima_overlay__?.getInstance());

        expect(instance).not.toBeNull();
    });

    test("should apply custom balloon styles when configured", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Trigger an error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Check if balloon has default styles
        const balloon = page.locator("#__v_o__balloon");
        const styles = await balloon.evaluate((element) => {
            const computed = globalThis.getComputedStyle(element);

            return {
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                position: computed.position,
            };
        });

        // Should have fixed position
        expect(styles.position).toBe("fixed");
    });

    test("should show balloon in correct position", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Trigger an error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        const balloon = page.locator("#__v_o__balloon");
        const boundingBox = await balloon.boundingBox();

        expect(boundingBox).not.toBeNull();

        if (boundingBox) {
            // Should be positioned in bottom-right by default
            const viewportSize = page.viewportSize();

            if (viewportSize) {
                // Balloon should be near bottom-right (allowing for some margin)
                expect(boundingBox.x + boundingBox.width).toBeGreaterThan(viewportSize.width * 0.7);
                expect(boundingBox.y + boundingBox.height).toBeGreaterThan(viewportSize.height * 0.7);
            }
        }
    });

    test("should allow sending errors via API", async ({ page }) => {
        await page.goto("/error-test");
        await waitForErrorTestPage(page);

        // Send error via API
        await page.evaluate(() => {
            const error = new Error("Test error sent via API");

            globalThis.__visulima_overlay__?.sendError(error);
        });

        await waitForErrorOverlay(page, 15_000);

        // Overlay should be visible
        const overlay = page.locator("#__v_o__root");

        await expect(overlay).toBeVisible();
    });
});
