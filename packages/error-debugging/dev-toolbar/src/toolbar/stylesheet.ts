import toolbarStylesRaw from "../ui/styles/main.css" with { type: "css" };

// CSS imports are inlined as strings by packem with mode: "inline"
const toolbarStyles = toolbarStylesRaw as string;

/**
 * Shared stylesheet for all shadow roots.
 * Created once and reused across all shadow roots to avoid CSS duplication.
 */
const createSharedStylesheet = (): CSSStyleSheet | undefined => {
    if (globalThis.window === undefined) {
        return undefined;
    }

    const sheet = new CSSStyleSheet();

    sheet.replaceSync(toolbarStyles);

    return sheet;
};

const sharedToolbarStylesheet: CSSStyleSheet | undefined = createSharedStylesheet();

export { sharedToolbarStylesheet };
