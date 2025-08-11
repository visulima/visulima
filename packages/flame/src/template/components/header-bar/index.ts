import type { Editor, Theme } from "../../../types";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";

const headerBar = (
    options: Partial<{ editor: Editor; openInEditorUrl?: string; theme: Theme }>,
): {
    html: string;
    script: string;
} => {
    const toggle = themeToggle(options.theme);

    return {
        html: `<div class="w-full flex gap-3 items-center">
    <div class="grow"></div>
    ${options.openInEditorUrl ? editorSelector(options.editor) : ""}
    <button type="button" data-shortcuts-open aria-label="Open keyboard shortcuts" title="Keyboard shortcuts" class="px-2 py-1 cursor-pointer rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs">?</button>
    ${toggle.html}
</div>`,
        script: `
        ${toggle.script}
        `,
    };
};

export default headerBar;
