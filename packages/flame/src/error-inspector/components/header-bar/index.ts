import type { Editor, Theme } from "../../../types";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";
import shortcutsButton from "../shortcuts-button";

const headerBar = (
    options: Partial<{ editor: Editor; openInEditorUrl?: string; theme: Theme }>,
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
      <button type="button" class="px-2 py-1 rounded-[var(--flame-radius-md)] text-xs bg-[var(--flame-chip-bg)] text-[var(--flame-chip-text)] shadow-[var(--flame-elevation-1)]">Stack</button>
      <button type="button" class="px-2 py-1 rounded-[var(--flame-radius-md)] text-xs bg-[var(--flame-white-smoke)] text-[var(--flame-text)] shadow-[var(--flame-elevation-1)]">Context</button>
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
