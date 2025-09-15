import { expect, test } from "@playwright/test";
import { expect, it } from "vitest";

test.describe("Basic Infrastructure Test", () => {
    it("should load the homepage", async ({ page }) => {
        await page.goto("/");

        await expect(page).toHaveTitle(/TanStack/);
    });

    it("should load the error test page", async ({ page }) => {
        await page.goto("/error-test");

        await expect(page.locator("h1")).toContainText("Error Overlay Test Page");
    });

    it("should have test buttons on error test page", async ({ page }) => {
        await page.goto("/error-test");

        // Check if test buttons are present
        const simpleErrorButton = page.locator("[data-testid='simple-error-btn']");
        const causeChainButton = page.locator("[data-error-trigger]");

        await expect(simpleErrorButton).toBeVisible();
        await expect(causeChainButton).toBeVisible();
    });

    it("should navigate from home to error test", async ({ page }) => {
        await page.goto("/");
        await page.click("text=🧪 Test Error Overlay");

        await expect(page.locator("h1")).toContainText("Error Overlay Test Page");
    });
});
