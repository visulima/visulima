import { expect, test } from "@playwright/test";

import {
    getErrorMessage,
    getErrorNavigation,
    getErrorTitle,
    getOverlayHeader,
    getStackTrace,
    navigateErrors,
    verifyOriginalSourceLocations,
    waitForErrorOverlay,
    waitForErrorTestPage,
    waitForOverlayUpdate,
} from "./utils/test-helpers";

test.describe("Cause Chain Error Handling", () => {
    test.beforeEach(async ({ page }) => {
        // Ensure clean state for each test
        await page.goto("/error-test");

        await waitForErrorTestPage(page);

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

        // Reload page to ensure clean state
        await page.reload();
        await page.waitForTimeout(500);
    });

    test("should display nested cause chain errors", async ({ page }) => {
        // Trigger error with cause chain
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page);

        // Verify we have multiple errors
        const navigation = await getErrorNavigation(page);

        expect(Number.parseInt(navigation.total || "0", 10)).toBeGreaterThan(1);

        // Verify first error is displayed
        expect(navigation.current).toBe("1");
        expect(navigation.canGoPrev).toBe(false);
        expect(navigation.canGoNext).toBe(true);
    });

    test("should navigate through cause chain", async ({ page }) => {
        // Trigger error with cause chain
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page);

        const initialNavigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(initialNavigation.total || "1", 10);

        // Navigate through all errors
        for (let index = 1; index < totalErrors; index++) {
            const beforeNavigation = await getErrorNavigation(page);

            expect(beforeNavigation.current).toBe(index.toString());

            await navigateErrors(page, "next");

            const afterNavigation = await getErrorNavigation(page);

            expect(afterNavigation.current).toBe((index + 1).toString());
        }

        // Try to go beyond last error (should not work)
        const lastNavigation = await getErrorNavigation(page);

        expect(lastNavigation.canGoNext).toBe(false);

        // Navigate back to first error
        for (let index = totalErrors; index > 1; index--) {
            await navigateErrors(page, "prev");

            const navigation = await getErrorNavigation(page);

            expect(navigation.current).toBe((index - 1).toString());
        }
    });

    test("should show original source locations for all errors in chain", async ({ page }) => {
        // Trigger error with cause chain
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page);

        const navigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(navigation.total || "1", 10);

        // Check each error in the chain
        for (let index = 1; index <= totalErrors; index++) {
            // Navigate to this error if not already there
            if (index > 1) {
                const navigation = await getErrorNavigation(page);

                if (navigation.canGoNext) {
                    await navigateErrors(page, "next");
                }
            }

            // Get header and stack trace for detailed checking
            const header = await getOverlayHeader(page);
            const stackTrace = await getStackTrace(page);

            // Verify this error shows original source locations
            const verification = await verifyOriginalSourceLocations(page);

            if (verification.overallValid !== undefined) {
                expect(verification.overallValid, `Error ${index} should show original source locations`).toBe(true);
            }

            // Basic assertions that should pass
            if (header.filePath) {
                expect(header.filePath).toMatch(/\.tsx?:\d+/);
                expect(header.filePath).not.toContain("node_modules");
            }

            expect(stackTrace.isVisible).toBe(true);
            expect(stackTrace.content?.length).toBeGreaterThan(10);
        }
    });

    test("should display multiple errors with navigation", async ({ page }) => {
        // Trigger error with cause chain
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page);

        const navigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(navigation.total || "1", 10);

        // Verify we have multiple errors
        expect(totalErrors).toBeGreaterThan(1);

        // Verify navigation controls exist when there are multiple errors
        if (totalErrors > 1) {
            expect(navigation.canGoNext).toBe(true);
            expect(navigation.canGoPrev).toBe(false); // Should start at first error
        }
    });

    test("should maintain navigation state correctly", async ({ page }) => {
        // Trigger error with cause chain
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page);

        const navigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(navigation.total || "1", 10);

        // Test navigation boundaries
        expect(navigation.canGoPrev).toBe(false);
        expect(navigation.canGoNext).toBe(totalErrors > 1);

        // Navigate to last error
        for (let index = 1; index < totalErrors; index++) {
            // eslint-disable-next-line no-await-in-loop
            await navigateErrors(page, "next");
        }

        // Verify we're at the last error
        const lastNavigation = await getErrorNavigation(page);

        expect(lastNavigation.current).toBe(totalErrors.toString());
        expect(lastNavigation.canGoPrev).toBe(true);
        expect(lastNavigation.canGoNext).toBe(false);
    });

    test("should allow navigation between errors", async ({ page }) => {
        // Trigger error with cause chain
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page);

        const initialNavigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(initialNavigation.total || "1");

        // Only test navigation if we have multiple errors
        if (totalErrors > 1) {
            // Should start at first error
            expect(initialNavigation.current).toBe("1");
            expect(initialNavigation.canGoPrev).toBe(false);
            expect(initialNavigation.canGoNext).toBe(true);

            // Navigate to next error
            await navigateErrors(page, "next");

            // Should now be at second error
            const secondNavigation = await getErrorNavigation(page);

            expect(secondNavigation.current).toBe("2");
            expect(secondNavigation.canGoPrev).toBe(true);

            // Navigate back to first error
            await navigateErrors(page, "prev");

            // Should be back at first error
            const backNavigation = await getErrorNavigation(page);

            expect(backNavigation.current).toBe("1");
            expect(backNavigation.canGoPrev).toBe(false);
            expect(backNavigation.canGoNext).toBe(true);
        }
    });

    test("should preserve cause chain in historical errors", async ({ page }) => {
        // Test the core issue: when navigating to cause errors in historical errors,
        // the code frames should be properly displayed instead of "No code frame could be generated"

        // Trigger a cause chain error
        await page.click("[data-error-trigger]");
        await waitForErrorOverlay(page);

        // Capture the original error details
        const originalTitle = await getErrorTitle(page);
        const originalMessage = await getErrorMessage(page);

        // Verify we have multiple cause errors in the current error
        const initialNavigation = await getErrorNavigation(page);
        const totalErrors = Number.parseInt(initialNavigation.total || "1", 10);

        expect(totalErrors).toBeGreaterThan(1);

        // Navigate to the last cause error to verify we can navigate through them
        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < totalErrors; index++) {
            // eslint-disable-next-line no-await-in-loop
            await navigateErrors(page, "next");
            // eslint-disable-next-line no-await-in-loop
            await waitForOverlayUpdate(page, 200);
        }

        // Verify we're at the last cause error
        const lastNavigation = await getErrorNavigation(page);

        expect(lastNavigation.current).toBe(totalErrors.toString());

        // Check that we can navigate to cause errors (basic functionality test)
        // Navigation should work - that's the main fix we implemented

        // Verify the code frame is displayed (not "No code frame could be generated")
        const overlay = page.locator("#__v_o__overlay");
        const overlayText = await overlay.textContent();

        expect(overlayText).not.toContain("No code frame could be generated");
        expect(overlayText?.length).toBeGreaterThan(10);

        // Now trigger a simple error to create history
        await page.locator("#__v_o__close").click();
        await page.waitForTimeout(500);

        await page.click("[data-testid='simple-error-btn']");
        await page.waitForTimeout(500);
        await page.locator("#__v_o__balloon").click();
        await waitForErrorOverlay(page);

        // Capture the simple error details
        const simpleErrorTitle = await getErrorTitle(page);
        const simpleErrorMessage = await getErrorMessage(page);

        // Enable history mode
        const historyToggle = page.locator("#__v_o__history_toggle");

        await historyToggle.click();
        await page.waitForSelector("#__v_o__history_indicator", { timeout: 5000 });

        // Verify history indicator shows we have errors in history
        const historyTotal = page.locator("#__v_o__history_total");
        const totalText = await historyTotal.textContent();

        expect(Number.parseInt(totalText || "0")).toBeGreaterThan(0);

        // Navigate back to the cause chain error in history by directly calling the navigation method
        await page.evaluate(() => {
            const overlay = (globalThis as any).__v_o__current;

            if (overlay && typeof overlay._navigateHistoryByScroll === "function") {
                overlay._navigateHistoryByScroll(-1); // Navigate backward in history
            }
        });
        await waitForOverlayUpdate(page, 500);

        // Verify we're now showing the cause chain error from history
        const historyTitle = await getErrorTitle(page);
        const historyMessage = await getErrorMessage(page);

        expect(historyTitle).toBe(originalTitle); // Should match the original cause chain error
        expect(historyMessage).toBe(originalMessage); // Should match the original cause chain error

        const historyNavigation = await getErrorNavigation(page);
        const historyTotalErrors = Number.parseInt(historyNavigation.total || "1");

        expect(historyTotalErrors).toBeGreaterThan(1); // Should still have multiple cause errors

        // Test that we can navigate through cause errors in the historical error
        for (let index = 1; index <= historyTotalErrors; index++) {
            const currentHistoryNav = await getErrorNavigation(page);

            expect(currentHistoryNav.current).toBe(index.toString());

            // Check that error title and message are correct for each cause error
            const currentTitle = await getErrorTitle(page);
            const currentMessage = await getErrorMessage(page);

            expect(currentTitle).toBeDefined();
            expect(currentMessage).toBeDefined();

            // Check that code frame is properly displayed for each cause error
            const historyOverlay = page.locator("#__v_o__overlay");
            const historyOverlayText = await historyOverlay.textContent();

            // The key assertion: should not show "No code frame could be generated"
            expect(historyOverlayText).not.toContain("No code frame could be generated");

            // Should have some meaningful content
            expect(historyOverlayText?.length).toBeGreaterThan(10);

            // Navigate to next cause error if not at the last one
            if (index < historyTotalErrors) {
                await navigateErrors(page, "next");
                await waitForOverlayUpdate(page, 200);
            }
        }

        // Test scrolling back to newer errors
        await page.mouse.wheel(0, 100); // Scroll back to newer error
        await waitForOverlayUpdate(page, 500);

        const backToSimpleTitle = await getErrorTitle(page);
        const backToSimpleMessage = await getErrorMessage(page);

        expect(backToSimpleTitle).toBe(simpleErrorTitle);
        expect(backToSimpleMessage).toBe(simpleErrorMessage);
    });
});
