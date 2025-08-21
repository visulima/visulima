import type { DisplayerOptions, Editor, Theme } from "../../../types";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";
import shortcutsButton from "../shortcuts-button";

const headerBar = (
    options: Partial<{ editor: Editor; openInEditorUrl?: string; theme: Theme }> | DisplayerOptions,
    hasContextTab = false,
): {
    html: string;
    script: string;
} => {
    const toggle = themeToggle(options.theme);

    return {
        html: `<div class="w-full flex gap-3 items-center">
    ${
        hasContextTab
            ? `<nav class="flex gap-1">
      <button type="button" class="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700">Stack</button>
      <button type="button" class="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800">Context</button>
    </nav>`
            : ""
    }
    <div class="grow"></div>
    ${options.openInEditorUrl ? editorSelector(options.editor) : ""}
    ${shortcutsButton()}
    ${toggle.html}
</div>`,
        script: `${toggle.script}`,
    };
};

export default headerBar;
