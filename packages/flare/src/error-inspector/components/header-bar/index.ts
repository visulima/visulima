import type { Theme } from "../../../types";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";
import shortcutsButton from "../shortcuts-button";
import type Editors from "../../../../../../shared/utils/editors";

const headerBar = (
    options: Partial<{ editor: Editor; theme: Theme }>,
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
      <button type="button" class="px-2 py-1 rounded-[var(--flare-radius-md)] text-xs bg-[var(--flare-chip-bg)] text-[var(--flare-chip-text)] shadow-[var(--flare-elevation-1)]">Stack</button>
      <button type="button" class="px-2 py-1 rounded-[var(--flare-radius-md)] text-xs bg-[var(--flare-white-smoke)] text-[var(--flare-text)] shadow-[var(--flare-elevation-1)]">Context</button>
    </nav>`
            : ""
    }
    <div class="grow"></div>
    ${editorSelector(options.editor)}
    ${shortcutsButton()}
    ${toggle.html}
</div>`,
        script: `${toggle.script}
// Initialize editor selector from localStorage if available
(function(){
  (window.subscribeToDOMContentLoaded || function (fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  })(function(){
    try {
      var saved = null;
      try { saved = localStorage.getItem('flare:editor'); } catch(_) {}
      var sel = document.getElementById('editor-selector');
      if (sel && saved && sel.value !== saved) {
        try { sel.value = saved; } catch(_) {}
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch(_) {}
      }
    } catch(_) {}
  });
})();
`,
    };
};

export default headerBar;
