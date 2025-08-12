import type { DisplayerOptions, Editor, Theme } from "../../../types";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";

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
            ? `<nav role="tablist" aria-label="View" class="flex gap-1">
      <button type="button" role="tab" data-tab="stack" aria-selected="true" class="px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700">Stack</button>
      <button type="button" role="tab" data-tab="context" aria-selected="false" class="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800">Context</button>
    </nav>`
            : ""
    }
    <div class="grow"></div>
    ${options.openInEditorUrl ? editorSelector(options.editor) : ""}
    <button type="button" data-shortcuts-open aria-label="Open keyboard shortcuts" title="Keyboard shortcuts" class="px-2 py-1 cursor-pointer rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs">?</button>
    ${toggle.html}
</div>`,
        script: `
        ${toggle.script}
        ${
            hasContextTab
                ? `
        (window.subscribeToDOMContentLoaded || function (fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); })(function(){
          function select(tab){
            var stackBtn = document.querySelector('[data-tab="stack"]');
            var ctxBtn = document.querySelector('[data-tab="context"]');
            var stack = document.getElementById('flame-section-stack');
            var context = document.getElementById('flame-section-context');
            var isStack = tab === 'stack';
            try { if (stackBtn) { stackBtn.setAttribute('aria-selected', String(isStack)); stackBtn.classList.toggle('bg-gray-200', isStack); stackBtn.classList.toggle('bg-gray-100', !isStack); stackBtn.classList.toggle('dark:bg-gray-700', isStack); stackBtn.classList.toggle('dark:bg-gray-800', !isStack); } } catch(_){}
            try { if (ctxBtn) { ctxBtn.setAttribute('aria-selected', String(!isStack)); ctxBtn.classList.toggle('bg-gray-200', !isStack); ctxBtn.classList.toggle('bg-gray-100', isStack); ctxBtn.classList.toggle('dark:bg-gray-700', !isStack); ctxBtn.classList.toggle('dark:bg-gray-800', isStack); } } catch(_){}
            try { if (stack) stack.classList.toggle('hidden', !isStack); } catch(_){}
            try { if (context) context.classList.toggle('hidden', isStack); } catch(_){}
          }
          try {
            var initial = 'stack';
            select(initial);
            var stackBtn = document.querySelector('[data-tab="stack"]');
            var ctxBtn = document.querySelector('[data-tab="context"]');
            if (stackBtn) stackBtn.addEventListener('click', function(){ select('stack'); });
            if (ctxBtn) ctxBtn.addEventListener('click', function(){ select('context'); });
          } catch(_){}
        });
        `
                : ""
        }
        `,
    };
};

export default headerBar;
