import { expect, test } from "@playwright/test";
import { expect, it } from "vitest";

import { getErrorNavigation, getOverlayHeader, waitForErrorOverlay } from "./utils/test-helpers";

test.describe("Functional Error Overlay Test", () => {
    test.beforeEach(async ({ page }) => {
        // Start with homepage to test the initial error
        await page.goto("/");

        // Try to close any existing overlay
        try {
            const closeButton = page.locator("#__v_o__close");

            if (await closeButton.isVisible()) {
                await closeButton.click();
                await page.waitForTimeout(500);
            }
        } catch {
            // Ignore if no overlay exists
        }
    });

    it("should display error overlay on homepage load", async ({ page }) => {
        // The homepage should automatically trigger an error on load
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay is visible
        const overlay = page.locator("#__v_o__overlay");

        await expect(overlay).toBeVisible();

        // Verify it's showing the cause chain error
        const navigation = await getErrorNavigation(page);

        expect(Number.parseInt(navigation.total || "0")).toBeGreaterThan(1);
    });

    it("should navigate through homepage cause chain", async ({ page }) => {
        await waitForErrorOverlay(page, 15_000);

        const navigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(navigation.total || "0");

        if (totalErrors > 1) {
            // Test navigation between errors
            const nextButton = page.locator("[data-flame-dialog-error-next]");
            const previousButton = page.locator("[data-flame-dialog-error-previous]");

            // Navigate to second error
            await nextButton.click();
            await page.waitForTimeout(500);

            let updatedNavigation = await getErrorNavigation(page);

            expect(updatedNavigation.current).toBe("2");

            // Navigate back to first error
            await previousButton.click();
            await page.waitForTimeout(500);

            updatedNavigation = await getErrorNavigation(page);

            expect(updatedNavigation.current).toBe("1");
        }
    });

    it("should display multiple errors in cause chain from error-test page", async ({ page }) => {
        // Navigate to error test page
        await page.goto("/error-test");

        // Click the cause chain button
        await page.click("[data-error-trigger]");

        // Add a small delay to let the error propagate
        await page.waitForTimeout(1000);

        await waitForErrorOverlay(page, 15_000);

        // Check if we have multiple errors
        const navigation = await getErrorNavigation(page);

        expect(Number.parseInt(navigation.total || "0")).toBeGreaterThan(1);
    });

    it("should show navigation controls for multiple errors", async ({ page }) => {
        // Navigate to error test page
        await page.goto("/error-test");

        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        const navigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(navigation.total || "0");

        if (totalErrors > 1) {
            // Should have navigation buttons
            const nextButton = page.locator("[data-flame-dialog-error-next]");
            const previousButton = page.locator("[data-flame-dialog-error-previous]");

            await expect(nextButton).toBeVisible();
            await expect(previousButton).toBeVisible();

            console.log("✅ Navigation controls are present");
        }
    });

    it("should display original source locations", async ({ page }) => {
        // Navigate to error test page
        await page.goto("/error-test");

        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        const header = await getOverlayHeader(page);

        // Should show original source path, not compiled
        expect(header.filePath).toMatch(/\.tsx?:\d+/);
        // Should not contain compiled/bundled paths - check for common compiled indicators
        expect(header.filePath).not.toContain("node_modules");
        expect(header.filePath).not.toMatch(/\.vite\//); // Should not be in .vite build directory
        expect(header.filePath).not.toMatch(/tsr-split/); // Should not have Vite's split chunk indicator
    });

    it("should be able to close the overlay", async ({ page }) => {
        // Navigate to error test page
        await page.goto("/error-test");

        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay is visible
        const overlay = page.locator("#__v_o__overlay");

        await expect(overlay).toBeVisible();

        // Try to close with ESC key
        await page.keyboard.press("Escape");

        // Wait for overlay to disappear
        await page.waitForSelector("#__v_o__overlay", { state: "hidden", timeout: 5000 });
    });

    it("should handle simple error button", async ({ page }) => {
        // Click simple error button
        await page.click("[data-testid='simple-error-btn']");
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay appears
        const overlay = page.locator("#__v_o__overlay");

        await expect(overlay).toBeVisible();
    });

    it("should use custom overlay instead of default Vite overlay", async ({ page }) => {
        // Navigate to the error test page
        await page.goto("/error-test");

        // Wait for the page to load completely
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000); // Extra time for React to render

        // Wait for the error test page content to appear
        await page.waitForSelector("h1:has-text(\"Error Overlay Test Page\")", { timeout: 10_000 });

        // Debug: Check if the button exists
        const buttonExists = await page.locator("[data-testid='simple-error-btn']").count();

        console.log(`Button exists: ${buttonExists}`);

        if (buttonExists === 0) {
            // Take a screenshot for debugging
            await page.screenshot({ path: "debug-no-button.png" });
            console.log("Page content:", await page.content());
            throw new Error("Test button not found");
        }

        // Click simple error button
        await page.click("[data-testid='simple-error-btn']");
        await waitForErrorOverlay(page, 15_000);

        // Check if our custom overlay is being used by looking for our specific elements
        const flameOverlay = page.locator("#__v_o__overlay");
        const flameHeading = page.locator("#__v_o__heading");
        const flameStacktrace = page.locator("#__v_o__stacktrace");

        // Our custom overlay should have these specific elements
        await expect(flameOverlay).toBeVisible();
        await expect(flameHeading).toBeVisible();
        await expect(flameStacktrace).toBeVisible();

        // Verify the overlay contains our error message
        const headingText = await flameHeading.textContent();

        expect(headingText).toContain("Error");

        console.log("✅ Custom overlay is being used");
    });

    it("should handle async error button", async ({ page }) => {
        // Navigate to error test page
        await page.goto("/error-test");

        // Click async error button
        await page.click("[data-testid='async-error-btn']");
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay appears
        const overlay = page.locator("#__v_o__overlay");

        await expect(overlay).toBeVisible();

        // Check for API-related error message
        const heading = page.locator("#__v_o__heading");
        const headingText = await heading.textContent();

        expect(headingText).toContain("API error");
    });

    it("should handle complex nested error", async ({ page }) => {
        // Navigate to error test page
        await page.goto("/error-test");

        // Click complex error button
        await page.click("[data-testid='complex-error-btn']");
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay appears
        const overlay = page.locator("#__v_o__overlay");

        await expect(overlay).toBeVisible();

        // Should have multiple errors in the chain
        const navigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(navigation.total || "0");

        expect(totalErrors).toBeGreaterThan(3); // Complex error has 4 levels
    });

    it.skip("should display readable stack trace with correct file paths", async ({ page }) => {
        // Click simple error button
        await page.click("[data-testid='simple-error-btn']");
        await waitForErrorOverlay(page, 15_000);

        // Get the stack trace content
        const stackTrace = page.locator("#__v_o__stacktrace");
        const stackContent = await stackTrace.textContent();

        // Verify stack trace exists and has content
        expect(stackContent).toBe(true);
        expect(stackContent?.length).toBeGreaterThan(10);

        // Verify stack trace doesn't contain unknown placeholders
        expect(stackContent).not.toContain("<unknown>:0:0");

        // Verify stack trace contains actual file information
        expect(stackContent).toMatch(/\.tsx?:\d+/);
        expect(stackContent).toMatch(/at\s+\w+/); // Should have "at functionName" format

        // Verify it contains the error function name
        expect(stackContent).toContain("triggerSimpleError");

        console.log("Stack trace content:", stackContent);

        // Also log the raw error details if available
        const rawError = await page.evaluate(
            () =>
                // Try to get the last error from the window
                (globalThis as any).lastError || null,
        );

        if (rawError) {
            console.log("Raw error from window:", rawError);
        }
    });
});
