import { expect, test } from "@playwright/test";
import { waitForErrorTestPage } from "./utils/test-helpers";

test.describe("Basic Infrastructure Test", () => {
    test("should load the homepage", async ({ page }) => {
        await page.goto("/");

        await expect(page).toHaveTitle(/TanStack/);

        // Homepage no longer shows error overlay by default
        // This test is just checking basic homepage loading
    });

    test("should load the error test page", async ({ page }) => {
        await page.goto("/error-test");

        await waitForErrorTestPage(page);
        await expect(page.locator("h1")).toContainText("Error Overlay Test Page");
    });

    test("should have test buttons on error test page", async ({ page }) => {
        await page.goto("/error-test");

        await waitForErrorTestPage(page);

        // Check if test buttons are present
        const simpleErrorButton = page.locator("[data-testid='simple-error-btn']");
        const causeChainButton = page.locator("[data-error-trigger]");

        await expect(simpleErrorButton).toBeVisible();
        await expect(causeChainButton).toBeVisible();
    });

});
