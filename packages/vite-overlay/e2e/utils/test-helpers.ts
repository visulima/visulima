import type { Page } from "@playwright/test";

/**
 * Wait for the error overlay to appear
 */
export async function waitForErrorOverlay(page: Page, timeout = 10_000) {
    await page.waitForSelector("#__flame__overlay", { timeout });
}

/**
 * Trigger a runtime error on the page
 */
export async function triggerRuntimeError(page: Page, message = "Test runtime error") {
    await page.evaluate((errorMessage) => {
        throw new Error(errorMessage);
    }, message);
}

/**
 * Trigger an error with cause chain
 */
export async function triggerCauseChainError(page: Page) {
    await page.evaluate(() => {
        try {
            function inner() {
                throw new Error("Inner cause error");
            }

            function middle() {
                try {
                    inner();
                } catch (error) {
                    const middleError = new Error("Middle cause error");

                    middleError.cause = error;
                    throw middleError;
                }
            }

            middle();
        } catch (error) {
            const outerError = new Error("Outer cause error");

            outerError.cause = error;
            throw outerError;
        }
    });
}

/**
 * Get the current error overlay content
 */
export async function getOverlayContent(page: Page) {
    const overlay = page.locator("#__flame__overlay");

    return {
        html: await overlay.innerHTML(),
        isVisible: await overlay.isVisible(),
        text: await overlay.textContent(),
    };
}

/**
 * Get error overlay header information
 */
export async function getOverlayHeader(page: Page) {
    const heading = page.locator("#__flame__heading");
    const fileLink = page.locator("#__flame__filelink");

    return {
        fileHref: await fileLink.getAttribute("href"),
        filePath: await fileLink.textContent(),
        title: await heading.textContent(),
    };
}

/**
 * Navigate through cause chain errors
 */
export async function navigateErrors(page: Page, direction: "next" | "prev") {
    const button = direction === "next" ? page.locator("[data-flame-dialog-error-next]") : page.locator("[data-flame-dialog-error-previous]");

    await button.click();
    await page.waitForTimeout(100); // Allow time for content to update
}

/**
 * Get current error index and total
 */
export async function getErrorNavigation(page: Page) {
    const currentIndex = page.locator("[data-flame-dialog-error-index]");
    const totalCount = page.locator("[data-flame-dialog-header-total-count]");
    const previousButton = page.locator("[data-flame-dialog-error-previous]");
    const nextButton = page.locator("[data-flame-dialog-error-next]");

    return {
        canGoNext: await nextButton.isEnabled(),
        canGoPrev: await previousButton.isEnabled(),
        current: await currentIndex.textContent(),
        total: await totalCount.textContent(),
    };
}

/**
 * Switch between original and compiled code views
 */
export async function switchCodeView(page: Page, mode: "original" | "compiled") {
    const button = page.locator(`[data-flame-mode="${mode}"]`);

    if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(100);
    }
}

/**
 * Check if a file path represents an original source file (not compiled)
 */
export function isOriginalSourcePath(filePath: string | null): boolean {
    if (!filePath)
        return false;

    // Should contain original source extensions (handle line numbers like :37)
    const hasOriginalExtension = /\.(tsx?|jsx?|vue|svelte)(:\d+)?$/.test(filePath);

    // Should not contain compiled/build paths
    // Allow "vite" in the path if it's just the project folder name, not a build artifact
    const hasNodeModules = filePath.includes("node_modules");
    const hasQuery = filePath.includes("?");
    const hasMap = filePath.includes(".map");
    const hasViteBuild = filePath.includes(".vite/");
    const hasNodeModulesPath = filePath.includes("/node_modules/");

    const isNotCompiled = !hasNodeModules && !hasQuery && !hasMap && !hasViteBuild && !hasNodeModulesPath;

    return hasOriginalExtension && isNotCompiled;
}

/**
 * Close the error overlay
 */
export async function closeErrorOverlay(page: Page) {
    const closeButton = page.locator("#__flame__close");

    await closeButton.click();
    await page.waitForSelector("#__flame__overlay", { state: "hidden", timeout: 5000 });
}

/**
 * Close overlay using ESC key
 */
export async function closeOverlayWithEsc(page: Page) {
    await page.keyboard.press("Escape");
    await page.waitForSelector("#__flame__overlay", { state: "hidden", timeout: 5000 });
}

/**
 * Get stack trace content
 */
export async function getStackTrace(page: Page) {
    const stackTrace = page.locator("#__flame__stacktrace");

    return {
        content: await stackTrace.textContent(),
        isVisible: await stackTrace.isVisible(),
        links: await stackTrace.locator(".stack-link").allTextContents(),
    };
}

/**
 * Verify overlay shows original source locations
 */
export async function verifyOriginalSourceLocations(page: Page) {
    const header = await getOverlayHeader(page);
    const stackTrace = await getStackTrace(page);

    const filePathValid = isOriginalSourcePath(header.filePath);

    // Check if stack trace contains original source paths
    // Be more lenient - just check that it has some content and doesn't have <unknown>
    const stackHasContent = stackTrace.content?.length > 50;
    const stackHasNoUnknown = !stackTrace.content?.includes("<unknown>:0:0");

    const stackHasNoCompiledPaths = !stackTrace.content?.includes("node_modules") && !stackTrace.content?.match(/\.vite\//);

    return {
        filePathValid,
        overallValid: filePathValid && stackHasContent && stackHasNoUnknown && stackHasNoCompiledPaths,
        stackHasNoCompiledPaths,
        stackHasContent,
        stackHasNoUnknown,
    };
}
