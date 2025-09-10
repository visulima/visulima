import { codeFrame, parseStacktrace } from "@visulima/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?data-uri&encoding=css";

import findLanguageBasedOnExtension from "../../../../../../shared/utils/find-language-based-on-extension";
import getFileSource from "../../../../../../shared/utils/get-file-source";
import getHighlighter from "../../../../../../shared/utils/get-highlighter";
import process from "../../../util/process";
import revisionHash from "../../../util/revision-hash";
import { sanitizeAttr as sanitizeAttribute, sanitizeHtml, sanitizeUrlAttr as sanitizeUrlAttribute } from "../../util/sanitize";
import cn from "../../util/tw";
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
            themes: {
                dark: "github-dark-default",
                light: "github-light",
            },
        });
        const safeCode = sanitizeHtml(code);

        const filePath = `${trace.file}:${trace.line}:${trace.column}`;
        const absPathForEditor = (trace.file || "").replace(/^file:\/\//, "");
        const relativeFilePath = filePath.replace(process.cwd?.() || "", "").replace("file:///", "");
        const safeMethod = sanitizeHtml(trace.methodName || "");
        const safeRelativePath = sanitizeHtml(relativeFilePath);
        tabs.push({
            html: `<button type="button" id="source-code-tabs-item-${uniqueKey}-${index}" data-stack-tab="#source-code-tabs-${uniqueKey}-${index}" aria-controls="source-code-tabs-${uniqueKey}-${index}" ${
                isClickable ? "" : "disabled aria-disabled=\"true\""
            } class="${cn(
                "relative inline-flex items-center gap-x-2 text-sm whitespace-nowrap p-6 w-full text-left border-l-2 border-transparent hover:bg-[var(--ono-hover-overlay)] text-[var(--ono-text-muted)] cursor-pointer",
                isClickable ? "cursor-pointer" : "cursor-not-allowed",
            )}">
    <div class="flex flex-col w-full text-left overflow-hidden min-w-0">
        <span class="font-medium text-[var(--ono-text)] truncate">${safeMethod}</span>
        <span class="text-sm text-[var(--ono-text-muted)] truncate">${safeRelativePath}</span>
    </div>
</button>`,
            type: trace.file ? getType(trace.file) : undefined,
        });

        sourceCode.push(`<div id="source-code-tabs-${uniqueKey}-${index}" class="${
            index === 0 && isClickable ? "block" : "hidden"
        }" aria-labelledby="source-code-tabs-item-${uniqueKey}-${index}" tabindex="0">
<div class="pt-6 px-6 text-sm text-right text-[var(--ono-text)]">
    ${
        options.openInEditorUrl
            ? `<button type=\"button\" class=\"underline hover:text-[var(--ono-link)]\" data-open-in-editor data-url=\"${sanitizeUrlAttribute(options.openInEditorUrl)}\" data-path=\"${sanitizeAttribute(
                absPathForEditor,
            )}\" data-line=\"${sanitizeAttribute(trace.line || 1)}\" data-column=\"${sanitizeAttribute(trace.column || 1)}\" title=\"Open ${safeRelativePath} in external editor\">${safeRelativePath} — Open in editor</button>`
            : isClickable
                ? `<button type=\"button\" class=\"underline hover:text-[var(--ono-link)]\" data-editor-link data-path=\"${sanitizeAttribute(absPathForEditor)}\" data-line=\"${sanitizeAttribute(
                    trace.line || 1,
                )}\" data-column=\"${sanitizeAttribute(trace.column || 1)}\" title=\"Open ${safeRelativePath} in editor\">${safeRelativePath} — Open in editor</button>`
                : safeRelativePath
    }
</div>
<div class="p-6">${safeCode}</div>
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

                return `<div class="flex items-center gap-2">
    <label for="${checkboxId}" class="relative text-sm text-[var(--ono-text)] flex gap-2 items-center">
        <div class="relative inline-flex h-5 w-9 cursor-pointer items-center">
            <input type="checkbox" id="${checkboxId}" data-group-toggle="${uniqueKey}" data-target-id="${detailsId}" class="peer sr-only">
            <span class="absolute inset-0 rounded-full bg-[var(--ono-chip-bg)] transition-colors peer-checked:bg-[var(--ono-red-orange)]"></span>
            <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"></span>
        </div>
        <span class="cursor-pointer" title="Toggle visibility of ${label} frames">${label}</span>
    </label>
</div>`;
            }

            return "";
        })
        .join("");

    const hasToggles = togglesHtml.trim().length > 0;
    const paddingClass = hasToggles ? "p-6" : "p-0";
    const headerLabel = hasToggles ? "<span class=\"block text-xs mb-2 text-[var(--ono-text-muted)]\">Show or Hide collapsed frames</span>" : "";

    const html = `<section class="container rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-2)] bg-[var(--ono-surface)]" aria-label="Stack trace viewer">
    <main id="stack-trace-viewer" class="flex flex-row">
        <div class="w-4/12 rounded-tl-lg rounded-bl-lg overflow-hidden">
            <div class="${paddingClass}">
                ${headerLabel}
                <div class="flex flex-row items-center gap-2">${togglesHtml}</div>
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
<summary class="py-3 px-6 cursor-pointer flex items-center justify-between text-sm hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:ring-1 focus:ring-gray-600 text-[var(--ono-text)]">
    <span class="flex items-center gap-2">
      <span class="uppercase tracking-wide text-[10px] text-[var(--ono-text-muted)]">${groupLabel}</span>
      <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)]">${tab.length}</span>
    </span>
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
        <div class="w-8/12 rounded-tr-lg rounded-br-lg overflow-hidden bg-[var(--ono-surface)]">${sourceCode.join("")}</div>
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
            if (!window.__onoOpenInEditorBound) {
              window.__onoOpenInEditorBound = true;

              // Known editor URL scheme templates (%f=file, %l=line, %c=column if supported)
              var __EDITOR_SCHEMES__ = {
                // Common
                'code': 'vscode://file/%f:%l:%c',
                'code-insiders': 'vscode-insiders://file/%f:%l:%c',
                'vscode': 'vscode://file/%f:%l:%c',
                'vscodium': 'vscodium://file/%f:%l:%c',
                'codium': 'vscodium://file/%f:%l:%c',
                'cursor': 'cursor://file/%f:%l:%c',
                'sublime': 'subl://open?url=file://%f&line=%l&column=%c',
                'atom': 'atom://core/open/file?filename=%f&line=%l&column=%c',
                'atom-beta': 'atom-beta://core/open/file?filename=%f&line=%l&column=%c',
                'brackets': 'brackets://open?url=file://%f&line=%l',

                // JetBrains family
                'webstorm': 'webstorm://open?file=%f&line=%l',
                'intellij': 'idea://open?file=%f&line=%l',
                'idea': 'idea://open?file=%f&line=%l',
                'phpstorm': 'phpstorm://open?file=%f&line=%l',
                'pycharm': 'pycharm://open?file=%f&line=%l',
                'rubymine': 'rubymine://open?file=%f&line=%l',
                'clion': 'clion://open?file=%f&line=%l',
                'rider': 'rider://open?file=%f&line=%l',
                'appcode': 'appcode://open?file=%f&line=%l',
                'android-studio': 'idea://open?file=%f&line=%l',

                // Others
                'visualstudio': 'visualstudio://open?file=%f&line=%l',
                'notepad++': 'notepad-plus-plus://open?file=%f&line=%l',
                'textmate': 'txmt://open?url=file://%f&line=%l',
                'macvim': 'mvim://open?url=file://%f&line=%l',
                'emacs': 'emacs://open?url=file://%f&line=%l',
                'emacsforosx': 'emacs://open?url=file://%f&line=%l',
                'vim': 'vim://open?url=file://%f&line=%l',
                'neovim': 'nvim://open?url=file://%f&line=%l',
                'xcode': 'xcode://open?file=%f&line=%l',
                'zed': 'zed://open?file=%f&line=%l&column=%c'
              };

              function __getSelectedEditor__() {
                var selectedEditor = null;
                try {
                  var saved = localStorage.getItem('ono:editor');
                  if (saved) selectedEditor = saved;
                  var sel = document.getElementById('editor-selector');
                  if (sel && sel.value) {
                    selectedEditor = sel.value;
                  }
                } catch (_) {}
                return (selectedEditor || 'vscode').toLowerCase();
              }

              function __buildEditorUrl__(tpl, file, line, column) {
                var url = String(tpl).replace('%f', String(file)).replace('%l', String(line || 1));
                if (url.indexOf('%c') !== -1) {
                  url = url.replace('%c', String(column || 1));
                }
                return url;
              }

              function __openEditorScheme__(file, line, column) {
                if (!file) return;
                var editor = __getSelectedEditor__();
                var tpl = __EDITOR_SCHEMES__[editor] || __EDITOR_SCHEMES__['vscode'];
                var url = __buildEditorUrl__(tpl, file, line, column);
                try { window.location.href = url; } catch(_) {}
              }

              // Persist editor choice when user changes selector
              document.addEventListener('change', function(e){
                try {
                  var target = e.target;
                  if (target && target.id === 'editor-selector' && target.value) {
                    localStorage.setItem('ono:editor', target.value);
                  }
                } catch(_) {}
              });

              // Server-side open-in-editor
              document.addEventListener('click', function(e){
                var btn = (e.target && e.target.closest) ? e.target.closest('[data-open-in-editor]') : null;
                if (!btn) return;
                var url = btn.getAttribute('data-url');
                var file = btn.getAttribute('data-path');
                var line = parseInt(btn.getAttribute('data-line') || '1', 10) || 1;
                var column = parseInt(btn.getAttribute('data-column') || '1', 10) || 1;
                var selectedEditor = null;
                try {
                  var saved = localStorage.getItem('ono:editor');
                  if (saved) selectedEditor = saved;
                  var sel = document.getElementById('editor-selector');
                  if (sel && sel.value) {
                    selectedEditor = sel.value;
                    try { localStorage.setItem('ono:editor', sel.value); } catch (_) {}
                  }
                } catch (_) {}
                if (!url || !file) return;
                var body = { file: file, line: line, column: column };
                if (selectedEditor) body.editor = selectedEditor;
                try { fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch (_) {}
              });

              // Client-side fallback: open via editor URL scheme
              document.addEventListener('click', function(e){
                var btn = (e.target && e.target.closest) ? e.target.closest('[data-editor-link]') : null;
                if (!btn) return;
                e.preventDefault();
                var file = btn.getAttribute('data-path');
                var line = parseInt(btn.getAttribute('data-line') || '1', 10) || 1;
                var column = parseInt(btn.getAttribute('data-column') || '1', 10) || 1;
                __openEditorScheme__(file, line, column);
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
                b.classList.remove('text-[var(--ono-red-orange)]');
                b.classList.remove('border-[var(--ono-red-orange)]');
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
            button.classList.add('text-[var(--ono-red-orange)]');
            button.classList.add('border-[var(--ono-red-orange)]');
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
