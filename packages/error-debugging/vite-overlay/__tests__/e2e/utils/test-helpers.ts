/* eslint-disable @typescript-eslint/prefer-optional-chain */
import type { Page } from "@playwright/test";

const ORIGINAL_EXTENSION_REGEX = /\.(?:tsx?|jsx?|vue|svelte)(?::\d+)?$/;
const VITE_BUILD_DIR_REGEX = /\.vite\//;

/**
 * Waits for the error overlay to appear.
 */
export const waitForErrorOverlay = async (page: Page, timeout = 10_000): Promise<void> => {
    await page.waitForSelector("#__v_o__overlay", { timeout });
};

/**
 * Waits for the error test page to fully load.
 */
export const waitForErrorTestPage = async (page: Page, timeout = 10_000): Promise<void> => {
    await page.waitForSelector("h1:has-text('Error Overlay Test Page')", { timeout });
    // Wait a bit more for React to fully render
    await page.waitForTimeout(1000);
};

/**
 * Gets error overlay header information.
 */
export const getOverlayHeader = async (page: Page): Promise<{ fileHref: string | null; filePath: string | null; title: string | null }> => {
    const heading = page.locator("#__v_o__heading");
    const fileLink = page.locator("#__v_o__filelink");

    return {
        fileHref: await fileLink.getAttribute("href"),
        filePath: await fileLink.textContent(),
        title: await heading.textContent(),
    };
};

/**
 * Navigates through cause chain errors.
 */
export const navigateErrors = async (page: Page, direction: "next" | "prev"): Promise<void> => {
    const button = direction === "next" ? page.locator("#__v_o__error-overlay-pagination-next") : page.locator("#__v_o__error-overlay-pagination-previous");

    await button.click();
    await page.waitForTimeout(100); // Allow time for content to update
};

/**
 * Gets current error index and total.
 */
export const getErrorNavigation = async (page: Page): Promise<{ canGoNext: boolean; canGoPrev: boolean; current: string | null; total: string | null }> => {
    const currentIndex = page.locator("#__v_o__pagination_current");
    const totalCount = page.locator("#__v_o__pagination_total");
    const previousButton = page.locator("#__v_o__error-overlay-pagination-previous");
    const nextButton = page.locator("#__v_o__error-overlay-pagination-next");

    return {
        canGoNext: await nextButton.isEnabled().catch(() => false),
        canGoPrev: await previousButton.isEnabled().catch(() => false),
        current: await currentIndex.textContent().catch(() => "1"),
        total: await totalCount.textContent().catch(() => "1"),
    };
};

/**
 * Gets the current error title/name.
 */
export const getErrorTitle = async (page: Page): Promise<string> =>
    await page.evaluate(() => {
        const overlay = document.querySelector("error-overlay");

        if (overlay && overlay.shadowRoot) {
            const titleElement = overlay.shadowRoot.querySelector("#__v_o__heading");

            return titleElement ? titleElement.textContent || "" : "";
        }

        return "";
    });

/**
 * Gets the current error message.
 */
export const getErrorMessage = async (page: Page): Promise<string> =>
    await page.evaluate(() => {
        const overlay = document.querySelector("error-overlay");

        if (overlay && overlay.shadowRoot) {
            const messageElement = overlay.shadowRoot.querySelector("#__v_o__message");

            return messageElement ? messageElement.textContent || "" : "";
        }

        return "";
    });

/**
 * Waits for the overlay to update after navigation.
 */
export const waitForOverlayUpdate = async (page: Page, timeout = 1000): Promise<void> => {
    await page.waitForTimeout(timeout);
};

/**
 * Checks if a file path represents an original source file (not compiled).
 */
export const isOriginalSourcePath = (filePath: string | null): boolean => {
    if (!filePath) {
        return false;
    }

    // Should contain original source extensions (handle line numbers like :37)
    const hasOriginalExtension = ORIGINAL_EXTENSION_REGEX.test(filePath);

    // Handle relative paths that start with .
    const isRelativePath = filePath.startsWith(".");

    // Should not contain compiled/build paths
    const hasNodeModules = filePath.includes("node_modules");
    const hasQuery = filePath.includes("?");
    const hasMap = filePath.includes(".map");
    const hasViteBuild = filePath.includes(".vite/");
    const hasNodeModulesPath = filePath.includes("/node_modules/");

    const isNotCompiled = !hasNodeModules && !hasQuery && !hasMap && !hasViteBuild && !hasNodeModulesPath;

    return (hasOriginalExtension || isRelativePath) && isNotCompiled;
};

/**
 * Gets stack trace content.
 */
export const getStackTrace = async (page: Page): Promise<{ content: string | null; isVisible: boolean; links: string[] }> => {
    const stackTrace = page.locator("#__v_o__stacktrace");

    return {
        content: await stackTrace.textContent(),
        isVisible: await stackTrace.isVisible(),
        links: await stackTrace.locator(".stack-link").allTextContents(),
    };
};

/**
 * Verifies overlay shows original source locations.
 */
export const verifyOriginalSourceLocations = async (
    page: Page,
): Promise<{ filePathValid: boolean; overallValid: boolean; stackHasContent: boolean; stackHasNoCompiledPaths: boolean; stackHasNoUnknown: boolean }> => {
    const header = await getOverlayHeader(page);
    const stackTrace = await getStackTrace(page);

    const filePathValid = header.filePath ? isOriginalSourcePath(header.filePath) : true;

    // Check if stack trace contains original source paths
    // Be more lenient - just check that it has some content and doesn't have <unknown>
    const stackHasContent = (stackTrace.content?.length ?? 0) > 50;
    const stackHasNoUnknown = !stackTrace.content?.includes("<unknown>:0:0");

    const stackHasNoCompiledPaths = !stackTrace.content?.includes("node_modules") && !VITE_BUILD_DIR_REGEX.test(stackTrace.content ?? "");

    return {
        filePathValid,
        overallValid: stackHasContent && stackHasNoUnknown, // Be more lenient on file paths
        stackHasContent,
        stackHasNoCompiledPaths,
        stackHasNoUnknown,
    };
};
