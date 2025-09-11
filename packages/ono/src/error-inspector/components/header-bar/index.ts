import type Editors from "../../../../../../shared/utils/editors";
import type { Theme } from "../../../types";
import shortcutsButton from "../shortcuts-button";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";

const headerBar = (
    options: Partial<{ editor: Editors; openInEditorUrl?: string; theme: Theme }>,
    hasContextTab = false,
): {
    html: string;
    script: string;
} => {
    const toggle = themeToggle(options.theme);
    const shortcuts = shortcutsButton();

    return {
        html: `<div class="w-full flex gap-3 items-center">
    ${
        hasContextTab
            ? `<nav class="flex gap-1">
      <button type="button" class="px-2 py-1 rounded-[var(--ono-radius-md)] text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] shadow-[var(--ono-elevation-1)]" title="View stack trace">Stack</button>
      <button type="button" class="px-2 py-1 rounded-[var(--ono-radius-md)] text-xs bg-[var(--ono-white-smoke)] text-[var(--ono-text)] shadow-[var(--ono-elevation-1)]" title="View request context">Context</button>
    </nav>`
            : ""
    }
    <div class="grow"></div>
    ${options.openInEditorUrl ? editorSelector(options.editor) : ""}
    ${shortcuts.html}
    ${toggle.html}
</div>`,
        script: `${toggle.script}${
            options.openInEditorUrl
                ? `
// Initialize editor selector from localStorage if available
(function(){
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function(){
    try {
      var saved = localStorage.getItem('ono:editor');
      var sel = document.getElementById('editor-selector');
      if (sel && saved && sel.value !== saved) {
        sel.value = saved;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch(_) {}
  });
})();
`
                : ""
        }
`,
    };
};

export default headerBar;
