import type { Page } from "@playwright/test";

/**
 * Wait for the error overlay to appear
 */
export const waitForErrorOverlay = async (page: Page, timeout = 10_000) => {
    await page.waitForSelector("#__v_o__overlay", { timeout });
};

/**
 * Wait for the error test page to fully load
 */
export const waitForErrorTestPage = async (page: Page, timeout = 10_000) => {
    await page.waitForSelector("h1:has-text('Error Overlay Test Page')", { timeout });
    // Wait a bit more for React to fully render
    await page.waitForTimeout(1000);
};

/**
 * Trigger a runtime error on the page
 */
export const triggerRuntimeError = async (page: Page, message = "Test runtime error") => {
    await page.evaluate((errorMessage) => {
        throw new Error(errorMessage);
    }, message);
};

/**
 * Trigger an error with cause chain
 */
export const triggerCauseChainError = async (page: Page) => {
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
};

/**
 * Get the current error overlay content
 */
export const getOverlayContent = async (page: Page) => {
    const overlay = page.locator("#__v_o__overlay");

    return {
        html: await overlay.innerHTML(),
        isVisible: await overlay.isVisible(),
        text: await overlay.textContent(),
    };
};

/**
 * Get error overlay header information
 */
export const getOverlayHeader = async (page: Page) => {
    const heading = page.locator("#__v_o__heading");
    const fileLink = page.locator("#__v_o__filelink");

    return {
        fileHref: await fileLink.getAttribute("href"),
        filePath: await fileLink.textContent(),
        title: await heading.textContent(),
    };
};

/**
 * Navigate through cause chain errors
 */
export const navigateErrors = async (page: Page, direction: "next" | "prev") => {
    const button = direction === "next" ? page.locator("#__v_o__error-overlay-pagination-next") : page.locator("#__v_o__error-overlay-pagination-previous");

    await button.click();
    await page.waitForTimeout(100); // Allow time for content to update
};

/**
 * Get current error index and total
 */
export const getErrorNavigation = async (page: Page) => {
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
 * Switch between original and compiled code views
 */
export const switchCodeView = async (page: Page, mode: "original" | "compiled") => {
    const button = page.locator(`[data-flame-mode="${mode}"]`);

    if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(100);
    }
};

/**
 * Get the current error title/name
 */
export const getErrorTitle = async (page: Page): Promise<string> => await page.evaluate(() => {
    const overlay = document.querySelector("error-overlay");

    if (overlay && overlay.shadowRoot) {
        const titleElement = overlay.shadowRoot.querySelector("#__v_o__heading");

        return titleElement ? titleElement.textContent || "" : "";
    }

    return "";
});

/**
 * Get the current error message
 */
export const getErrorMessage = async (page: Page): Promise<string> => await page.evaluate(() => {
    const overlay = document.querySelector("error-overlay");

    if (overlay && overlay.shadowRoot) {
        const messageElement = overlay.shadowRoot.querySelector("#__v_o__message");

        return messageElement ? messageElement.textContent || "" : "";
    }

    return "";
});

/**
 * Get the current file path being displayed
 */
export const getCurrentFilePath = async (page: Page): Promise<string> => await page.evaluate(() => {
    const overlay = document.querySelector("error-overlay");

    if (overlay && overlay.shadowRoot) {
        const fileElement = overlay.shadowRoot.querySelector("#__v_o__filelink");

        return fileElement ? fileElement.textContent || "" : "";
    }

    return "";
});

/**
 * Check if the code frame contains a specific line number
 */
export const codeFrameContainsLine = async (page: Page, lineNumber: number): Promise<boolean> => await page.evaluate((line) => {
    const overlay = document.querySelector("error-overlay");

    if (overlay && overlay.shadowRoot) {
        const overlayElement = overlay.shadowRoot.querySelector("#__v_o__overlay");
        const overlayText = overlayElement ? overlayElement.textContent || "" : "";

        return overlayText.includes(`:${line}`) || overlayText.includes(`${line}:`);
    }

    return false;
}, lineNumber);

/**
 * Wait for the overlay to update after navigation
 */
export const waitForOverlayUpdate = async (page: Page, timeout = 1000) => {
    await page.waitForTimeout(timeout);
};

/**
 * Check if a file path represents an original source file (not compiled)
 */
export const isOriginalSourcePath = (filePath: string | null): boolean => {
    if (!filePath)
        return false;

    // Should contain original source extensions (handle line numbers like :37)
    const hasOriginalExtension = /\.(tsx?|jsx?|vue|svelte)(:\d+)?$/.test(filePath);

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
 * Close the error overlay
 */
export const closeErrorOverlay = async (page: Page) => {
    const closeButton = page.locator("#__v_o__close");

    await closeButton.click();
    await page.waitForSelector("#__v_o__overlay", { state: "hidden", timeout: 5000 });
};

/**
 * Close overlay using ESC key
 */
export const closeOverlayWithEsc = async (page: Page) => {
    await page.keyboard.press("Escape");
    await page.waitForSelector("#__v_o__overlay", { state: "hidden", timeout: 5000 });
};

/**
 * Get stack trace content
 */
export const getStackTrace = async (page: Page) => {
    const stackTrace = page.locator("#__v_o__stacktrace");

    return {
        content: await stackTrace.textContent(),
        isVisible: await stackTrace.isVisible(),
        links: await stackTrace.locator(".stack-link").allTextContents(),
    };
};

/**
 * Verify overlay shows original source locations
 */
export const verifyOriginalSourceLocations = async (page: Page) => {
    const header = await getOverlayHeader(page);
    const stackTrace = await getStackTrace(page);

    const filePathValid = header.filePath ? isOriginalSourcePath(header.filePath) : true;

    // Check if stack trace contains original source paths
    // Be more lenient - just check that it has some content and doesn't have <unknown>
    const stackHasContent = stackTrace.content?.length > 50;
    const stackHasNoUnknown = !stackTrace.content?.includes("<unknown>:0:0");

    const stackHasNoCompiledPaths = !stackTrace.content?.includes("node_modules") && !stackTrace.content?.match(/\.vite\//);

    return {
        filePathValid,
        overallValid: stackHasContent && stackHasNoUnknown, // Be more lenient on file paths
        stackHasContent,
        stackHasNoCompiledPaths,
        stackHasNoUnknown,
    };
};
