import { codeFrame, parseStacktrace } from "@visulima/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?raw";

import findLanguageBasedOnExtension from "../../../util/find-language-based-on-extension";
import getFileSource from "../../../util/get-file-source";
import process from "../../../util/process";
import revisionHash from "../../../util/revision-hash";
import getHighlighter from "../../util/highlighter";
import type { GroupType, Item } from "./types";
import getType from "./util/get-type";
import groupSimilarTypes from "./util/group-similar-types";

const stackTraceViewer = async (
    error: Error,
    options: { openInEditorUrl?: string } = {},
): Promise<{
    html: string;
    script: string;
    // eslint-disable-next-line sonarjs/cognitive-complexity
}> => {
    const uniqueKey = revisionHash(error.name + error.message + error.stack);

    const highlighter = await getHighlighter();

    const traces = parseStacktrace(error);

    const tabs: { html: string; type: GroupType }[] = [];
    const sourceCode: string[] = [];

    for await (const [index, trace] of traces.entries()) {
        const defaultSource = `// Unable to load source code for ${trace.file}:${trace.line}:${trace.column}`;

        const source = trace.file ? await getFileSource(trace.file) : undefined;
        const isClickable = Boolean(source);
        const sourceCodeFrame = source
            ? codeFrame(
                  source,
                  {
                      start: {
                          column: trace.column,
                          line: trace.line as number,
                      },
                  },
                  {
                      linesAbove: 9,
                      linesBelow: 10,
                      showGutter: false,
                  },
              )
            : defaultSource;

        const code = highlighter.codeToHtml(sourceCodeFrame, {
            lang: findLanguageBasedOnExtension(trace.file || ""),
            theme: "nord",
        });

        const filePath = `${trace.file}:${trace.line}:${trace.column}`;
        const absPathForEditor = (trace.file || "").replace(/^file:\/\//, "");
        const relativeFilePath = filePath.replace(process.cwd?.() || "", "").replace("file:///", "");

        tabs.push({
            html: `<button type="button" id="source-code-tabs-item-${uniqueKey}-${index}" data-tab="#source-code-tabs-${uniqueKey}-${index}" aria-controls="source-code-tabs-${uniqueKey}-${index}" ${
                isClickable ? "" : 'disabled aria-disabled="true"'
            } class="tab-active:font-semibold tab-active:border-blue-600 tab-active:text-blue-600 inline-flex items-center gap-x-2 border-b border-gray-100 last:border-transparent text-sm whitespace-nowrap text-gray-500 hover:text-blue-600 disabled:opacity-50 disabled:pointer-events-none dark:text-gray-400 dark:hover:text-blue-500 dark:focus:outline-hidden dark:focus:ring-1 dark:focus:ring-gray-600 p-6 ${
                isClickable ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50" : "cursor-not-allowed"
            }" role="tab">
    <div class="flex flex-col w-full text-left">
        <span class="text-gray-900 dark:text-gray-100 font-medium">${trace.methodName}</span>
        <span class="text-gray-500 dark:text-gray-400 text-sm break-words">${relativeFilePath}</span>
    </div>
</button>`,
            type: trace.file ? getType(trace.file) : undefined,
        });

        sourceCode.push(`<div id="source-code-tabs-${uniqueKey}-${index}" class="${
            index === 0 && isClickable ? "block" : "hidden"
        }" role="tabpanel" aria-labelledby="source-code-tabs-item-${uniqueKey}-${index}">
<div class="pt-10 pb-8 mb-6 text-sm text-right text-[#D8DEE9] dark:text-gray-400 border-b border-gray-600">
    <div class="px-6">
        ${options.openInEditorUrl ? `<button type="button" class="underline hover:text-blue-400" data-open-in-editor data-url="${options.openInEditorUrl}" data-path="${absPathForEditor}" data-line="${trace.line || 1}" data-column="${trace.column || 1}">${relativeFilePath} — Open in editor</button>` : relativeFilePath}
    </div>
</div>
<div class="p-6">${code}</div>
</div>`);
    }

    const grouped = groupSimilarTypes(tabs);

    // Build group toggles and decide if header parts should be shown
    const togglesHtml = grouped
        .map((tab: Item | Item[], groupIndex: number) => {
            if (Array.isArray(tab)) {
                const first = tab[0] as Item;
                let label: string;

                switch (first.type) {
                    case "internal": {
                        label = "internal";
                        break;
                    }
                    case "node_modules": {
                        label = "node_modules";
                        break;
                    }
                    case "webpack": {
                        label = "webpack";
                        break;
                    }
                    default: {
                        label = "application";
                    }
                }

                const checkboxId = `small-switch-${uniqueKey}-${groupIndex}`;
                const detailsId = `stack-trace-group-${uniqueKey}-${groupIndex}`;

                return `<div class="flex items-center">
                            <input type="checkbox" id="${checkboxId}" data-group-toggle="${uniqueKey}" data-target-id="${detailsId}" class="relative w-[35px] h-[21px] bg-gray-100 border-transparent text-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:ring-blue-600 disabled:opacity-50 disabled:pointer-events-none checked:bg-none checked:text-blue-600 checked:border-blue-600 focus:checked:border-blue-600 dark:bg-gray-800 dark:border-gray-700 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-600 before:inline-block before:w-4 before:h-4 before:bg-white checked:before:bg-blue-200 before:translate-x-0 checked:before:translate-x-full before:rounded-full before:shadow-sm before:transform before:ring-0 before:transition before:ease-in-out before:duration-200 dark:before:bg-gray-400 dark:checked:before:bg-blue-200">
                            <label for="${checkboxId}" class="text-sm text-gray-500 ms-3 dark:text-gray-400">${label}</label>
                        </div>`;
            }

            return "";
        })
        .join("");

    const hasToggles = togglesHtml.trim().length > 0;
    const paddingClass = hasToggles ? "p-6" : "p-0";
    const headerLabel = hasToggles ? '<span class="block text-xs mb-2 text-gray-500 dark:text-gray-400">Show or Hide collapsed frames</span>' : "";

    const html = `<section class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-linear-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20">
    <main id="stack-trace-viewer" class="flex flex-row">
        <div class="w-4/12 rounded-tl-lg rounded-bl-lg overflow-hidden">
            <div class="border-b border-gray-100 ${paddingClass}">
                ${headerLabel}
                <div class="flex flex-row items-center">${togglesHtml}</div>
            </div>
            <nav class="flex flex-col" aria-label="Tabs" role="tablist">
                ${grouped
                    .map((tab, groupIndex: number) => {
                        if (Array.isArray(tab)) {
                            // Cast to Item to satisfy TypeScript, knowing it's an array of Item
                            const firstItem = tab[0] as Item;

                            let groupLabel: string;

                            switch (firstItem.type) {
                                case "internal": {
                                    groupLabel = "internal";
                                    break;
                                }
                                case "node_modules": {
                                    groupLabel = "node_modules";
                                    break;
                                }
                                case "webpack": {
                                    groupLabel = "webpack";
                                    break;
                                }
                                default: {
                                    groupLabel = "application";
                                }
                            }

                            return `<details id="stack-trace-group-${uniqueKey}-${groupIndex}" class="border-b border-gray-100 dark:border-gray-700">
<summary class="py-3 px-6 cursor-pointer flex items-center justify-between text-sm dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-hidden focus:ring-1 focus:ring-gray-600">
    <span>${tab.length} ${groupLabel} frames</span>
    <span data-chevron class="dui w-4 h-4 transition-transform duration-300" style="-webkit-mask-image:url('${chevronDownIcon}'); mask-image:url('${chevronDownIcon}')"></span>
</summary>
<div class="flex flex-col">${tab.map((item) => item.html).join("")}</div>
</details>`;
                        }

                        return tab.html;
                    })
                    .join("")}
            </nav>
        </div>
        <div class="w-8/12 bg-[#2e3440ff] rounded-tr-lg rounded-br-lg overflow-hidden">${sourceCode.join("")}</div>
    </main>
</section>`;

    const script = `
      (function(){
        (window.subscribeToDOMContentLoaded || function (fn) {
          if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
        })(function(){
          var buttonSelector = '[id^="source-code-tabs-item-${uniqueKey}-"]';
          var panelSelector = '[id^="source-code-tabs-${uniqueKey}-"]';
          var buttons = Array.prototype.slice.call(document.querySelectorAll(buttonSelector));
          var panels = Array.prototype.slice.call(document.querySelectorAll(panelSelector));
          var groupToggles = Array.prototype.slice.call(document.querySelectorAll('input[data-group-toggle="${uniqueKey}"]'));
          document.addEventListener('click', function(e){
            var btn = (e.target && (e.target as HTMLElement).closest) ? (e.target as HTMLElement).closest('[data-open-in-editor]') as HTMLElement : null;
            if (!btn) return;
            var url = btn.getAttribute('data-url');
            var file = btn.getAttribute('data-path');
            var line = parseInt(btn.getAttribute('data-line') || '1', 10) || 1;
            var column = parseInt(btn.getAttribute('data-column') || '1', 10) || 1;
            if (!url || !file) return;
            try { fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: file, line: line, column: column }) }); } catch (_) {}
          });

          function activate(button){
            buttons.forEach(function(b){ 
                b.classList.remove('active');
                b.classList.remove('bg-gray-100');
                b.classList.remove('dark:bg-gray-700/50');
                b.setAttribute('aria-selected','false');
            });

            panels.forEach(function(p){
                p.classList.add('hidden');
                p.classList.remove('block');
            });
            
            if (!button) {
              return;
            }

            button.classList.add('active');
            button.classList.add('bg-gray-100');
            button.classList.add('dark:bg-gray-700/50');
            button.setAttribute('aria-selected','true');
            var sel = button.getAttribute('data-tab');

            try {
              var panel = sel ? document.querySelector(sel) : null;
              if (panel){
                panel.classList.remove('hidden');
                panel.classList.add('block');
                }
            } catch (_) {}
          }

          buttons.forEach(function(b){
            b.addEventListener('click', function(e){
              if (b.hasAttribute('disabled')) { return; }
              e.preventDefault(); activate(b);
            });
          });

          // Ensure initial state consistent
          var initiallyActive = buttons.find(function(b){ return b.classList.contains('active') && !b.hasAttribute('disabled'); }) || buttons.find(function(b){ return !b.hasAttribute('disabled'); });
          activate(initiallyActive);

          // Wire group open/close toggles
          function syncCheckboxWithDetails(checkbox, details){
            try { checkbox.checked = !!details.open; } catch (_) {}
          }

          groupToggles.forEach(function(t){
            var targetId = t.getAttribute('data-target-id');
            var details = targetId ? document.getElementById(targetId) : null;
            if (!details) return;

            // Initialize checkbox state from details
            syncCheckboxWithDetails(t, details);

            // Change -> open/close details
            t.addEventListener('change', function(){
              try { details.open = !!t.checked; } catch (_) {}
            });

            // If user opens details via summary, reflect in checkbox
            details.addEventListener('toggle', function(){ syncCheckboxWithDetails(t, details); });
          });
        });
      })();
    `;

    return { html, script };
};

export default stackTraceViewer;
