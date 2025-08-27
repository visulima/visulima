import { codeFrame, parseStacktrace } from "@visulima/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?raw";

import findLanguageBasedOnExtension from "../../../util/find-language-based-on-extension";
import getFileSource from "../../../util/get-file-source";
import process from "../../../util/process";
import revisionHash from "../../../util/revision-hash";
import getHighlighter from "../../util/get-highlighter";
import type { GroupType, Item } from "./types";
import getType from "./util/get-type";
import groupSimilarTypes from "./util/group-similar-types";
import cn from "../../util/tw";

// Utility function to properly encode SVG content for CSS mask-image
const svgToDataUrl = (svgContent: string): string => {
    // Remove HTML comments and clean up the SVG content
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

    // Encode for use in CSS url()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

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
            themes: {
                light: "github-light",
                dark: "github-dark-default",
            },
        });

        const filePath = `${trace.file}:${trace.line}:${trace.column}`;
        const absPathForEditor = (trace.file || "").replace(/^file:\/\//, "");
        const relativeFilePath = filePath.replace(process.cwd?.() || "", "").replace("file:///", "");

        tabs.push({
            html: `<button type="button" id="source-code-tabs-item-${uniqueKey}-${index}" data-stack-tab="#source-code-tabs-${uniqueKey}-${index}" aria-controls="source-code-tabs-${uniqueKey}-${index}" ${
                isClickable ? "" : 'disabled aria-disabled="true"'
            } class="${cn(
                "inline-flex items-center gap-x-2 text-sm whitespace-nowrap p-6 w-full text-left border-l-2 border-transparent hover:bg-[var(--flame-hover-overlay)] text-[var(--flame-text-muted)]",
                isClickable ? "cursor-pointer" : "cursor-not-allowed",
            )}">
    <div class="flex flex-col w-full text-left">
        <span class="font-medium text-[var(--flame-text)]">${trace.methodName}</span>
        <span class="text-sm break-words text-[var(--flame-text-muted)]">${relativeFilePath}</span>
    </div>
</button>`,
            type: trace.file ? getType(trace.file) : undefined,
        });

        sourceCode.push(`<div id="source-code-tabs-${uniqueKey}-${index}" class="${
            index === 0 && isClickable ? "block" : "hidden"
        }" aria-labelledby="source-code-tabs-item-${uniqueKey}-${index}" tabindex="0">
<div class="pt-6 px-6 text-sm text-right text-[var(--flame-text)]">
    ${options.openInEditorUrl ? `<button type=\"button\" class=\"underline hover:text-[var(--flame-link)]\" data-open-in-editor data-url=\"${options.openInEditorUrl}\" data-path=\"${absPathForEditor}\" data-line=\"${trace.line || 1}\" data-column=\"${trace.column || 1}\">${relativeFilePath} — Open in editor</button>` : relativeFilePath}
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
                            <input type="checkbox" id="${checkboxId}" data-group-toggle="${uniqueKey}" data-target-id="${detailsId}" class="relative w-[35px] h-[21px] border text-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:ring-blue-600 disabled:opacity-50 disabled:pointer-events-none checked:bg-none checked:text-blue-600 checked:border-blue-600 focus:checked:border-blue-600 before:inline-block before:w-4 before:h-4 before:bg-white checked:before:bg-blue-200 before:translate-x-0 checked:before:translate-x-full before:rounded-full before:shadow-sm before:transform before:ring-0 before:transition before:ease-in-out before:duration-200 bg-[var(--flame-chip-bg)] border-[var(--flame-neutral-bg)]">
                            <label for="${checkboxId}" class="text-sm ms-3 text-[var(--flame-text)]">${label}</label>
                        </div>`;
            }

            return "";
        })
        .join("");

    const hasToggles = togglesHtml.trim().length > 0;
    const paddingClass = hasToggles ? "p-6" : "p-0";
    const headerLabel = hasToggles ? '<span class="block text-xs mb-2 text-[var(--flame-text-muted)]">Show or Hide collapsed frames</span>' : "";

    const html = `<section class="container rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)] bg-[var(--flame-surface)]" aria-label="Stack trace viewer">
    <main id="stack-trace-viewer" class="flex flex-row">
        <div class="w-4/12 rounded-tl-lg rounded-bl-lg overflow-hidden">
            <div class="${paddingClass}">
                ${headerLabel}
                <div class="flex flex-row items-center">${togglesHtml}</div>
            </div>
            <nav class="flex flex-col" aria-label="Frames">
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

                            return `<details id="stack-trace-group-${uniqueKey}-${groupIndex}">
<summary class="py-3 px-6 cursor-pointer flex items-center justify-between text-sm hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:ring-1 focus:ring-gray-600 text-[var(--flame-text)]">
    <span class="flex items-center gap-2">
      <span class="uppercase tracking-wide text-[10px] text-[var(--flame-text-muted)]">${groupLabel}</span>
      <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] bg-[var(--flame-chip-bg)] text-[var(--flame-chip-text)]">${tab.length}</span>
    </span>
    <span data-chevron class="dui w-4 h-4 transition-transform duration-300" style="-webkit-mask-image:url('${svgToDataUrl(chevronDownIcon)}'); mask-image:url('${svgToDataUrl(chevronDownIcon)}')"></span>
</summary>
<div class="flex flex-col">${tab.map((item) => item.html).join("")}</div>
</details>`;
                        }

                        return tab.html;
                    })
                    .join("")}
            </nav>
        </div>
        <div class="w-8/12 rounded-tr-lg rounded-br-lg overflow-hidden bg-[var(--flame-surface)]">${sourceCode.join("")}</div>
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

          try {
            if (!window.__flameOpenInEditorBound) {
              window.__flameOpenInEditorBound = true;

              document.addEventListener('click', function(e){
                var btn = (e.target && e.target.closest) ? e.target.closest('[data-open-in-editor]') : null;
                if (!btn) return;
                var url = btn.getAttribute('data-url');
                var file = btn.getAttribute('data-path');
                var line = parseInt(btn.getAttribute('data-line') || '1', 10) || 1;
                var column = parseInt(btn.getAttribute('data-column') || '1', 10) || 1;
                var selectedEditor = null;
                try {
                  var saved = localStorage.getItem('flame:editor');
                  if (saved) selectedEditor = saved;
                  var sel = document.getElementById('editor-selector');
                  if (sel && sel.value) {
                    selectedEditor = sel.value;
                    try { localStorage.setItem('flame:editor', sel.value); } catch (_) {}
                  }
                } catch (_) {}
                if (!url || !file) return;
                var body = { file: file, line: line, column: column };
                if (selectedEditor) body.editor = selectedEditor;
                try { fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch (_) {}
              });
            }
          } catch (_) {}

          function activate(button){
            buttons.forEach(function(b){
                b.classList.remove('active');
                b.classList.remove('bg-gray-100');
                b.classList.remove('dark:bg-gray-700/50');
                b.classList.remove('font-semibold');
                b.classList.remove('border-blue-600');
                b.classList.remove('text-blue-600');
                b.classList.remove('text-[var(--flame-red-orange)]');
                b.classList.remove('border-[var(--flame-red-orange)]');
                b.classList.remove('stack-tab-active');
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
            button.classList.add('font-semibold');
            button.classList.add('text-[var(--flame-red-orange)]');
            button.classList.add('border-[var(--flame-red-orange)]');
            button.classList.add('stack-tab-active');
            var sel = button.getAttribute('data-stack-tab');

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
            b.addEventListener('keydown', function(e){
              if (b.hasAttribute('disabled')) { return; }
              if (e && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(b); }
            });
          });

          // Ensure initial state consistent
          var initiallyActive = buttons.find(function(b){ return !b.hasAttribute('disabled'); });
          if (initiallyActive) {
            activate(initiallyActive);
          }

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
