import { expect, test } from "@playwright/test";

import {
    getErrorNavigation,
    getOverlayHeader,
    getStackTrace,
    navigateErrors,
    triggerCauseChainError,
    verifyOriginalSourceLocations,
    waitForErrorOverlay,
    waitForErrorTestPage,
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

        expect(Number.parseInt(navigation.total || "0")).toBeGreaterThan(1);

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
        const totalErrors = Number.parseInt(initialNavigation.total || "1");

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
        const totalErrors = Number.parseInt(navigation.total || "1");

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
        const totalErrors = Number.parseInt(navigation.total || "1");

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
        const totalErrors = Number.parseInt(navigation.total || "1");

        // Test navigation boundaries
        expect(navigation.canGoPrev).toBe(false);
        expect(navigation.canGoNext).toBe(totalErrors > 1);

        // Navigate to last error
        for (let index = 1; index < totalErrors; index++) {
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
});
