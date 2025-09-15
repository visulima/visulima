import { expect, test } from "@playwright/test";
import { expect, it } from "vitest";

import { getErrorNavigation, getOverlayHeader, waitForErrorOverlay } from "./utils/test-helpers";

test.describe("Functional Error Overlay Test", () => {
    test.beforeEach(async ({ page }) => {
        // Ensure clean state for each test
        await page.goto("/error-test");

        // Try to close any existing overlay
        try {
            const closeButton = page.locator("#__flame__close");

            if (await closeButton.isVisible()) {
                await closeButton.click();
                await page.waitForTimeout(500);
            }
        } catch {
            // Ignore if no overlay exists
        }

        // Reload page to ensure clean state
        await page.reload();
        await page.waitForTimeout(500);
    });

    it("should trigger and display error overlay from test page", async ({ page }) => {
        // Click the cause chain button to trigger an error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay is visible
        const overlay = page.locator("#__flame__overlay");

        await expect(overlay).toBeVisible();
    });

    it("should display multiple errors in cause chain", async ({ page }) => {
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
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay is visible
        const overlay = page.locator("#__flame__overlay");

        await expect(overlay).toBeVisible();

        // Try to close with ESC key
        await page.keyboard.press("Escape");

        // Wait for overlay to disappear
        await page.waitForSelector("#__flame__overlay", { state: "hidden", timeout: 5000 });
    });

    it("should handle simple error button", async ({ page }) => {
        // Click simple error button
        await page.click("[data-testid='simple-error-btn']");
        await waitForErrorOverlay(page, 15_000);

        // Verify overlay appears
        const overlay = page.locator("#__flame__overlay");

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
        const flameOverlay = page.locator("#__flame__overlay");
        const flameHeading = page.locator("#__flame__heading");
        const flameStacktrace = page.locator("#__flame__stacktrace");

        // Our custom overlay should have these specific elements
        await expect(flameOverlay).toBeVisible();
        await expect(flameHeading).toBeVisible();
        await expect(flameStacktrace).toBeVisible();

        // Verify the overlay contains our error message
        const headingText = await flameHeading.textContent();

        expect(headingText).toContain("Error");

        console.log("✅ Custom overlay is being used");
    });

    it.skip("should display readable stack trace with correct file paths", async ({ page }) => {
        // Click simple error button
        await page.click("[data-testid='simple-error-btn']");
        await waitForErrorOverlay(page, 15_000);

        // Get the stack trace content
        const stackTrace = page.locator("#__flame__stacktrace");
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
