import { codeFrame, parseStacktrace } from "@visulima/error";
import { getHighlighterCore } from "shikiji/core";
import { getWasmInlined } from "shikiji/wasm";
import nord from "shikiji/themes/nord.mjs";
import foldVerticalIcon from "lucide-static/icons/fold-vertical.svg";
import unfoldVerticalIcon from "lucide-static/icons/unfold-vertical.svg";

import process from "../../../util/process";
import getFileSource from "../../../util/get-file-source";
import type { GroupType, Item } from "./types";
import groupSimilarTypes from "./util/group-similar-types";
import getType from "./util/get-type";

const stackTraceViewer = async (error: Error): Promise<string> => {
    const shiki = await getHighlighterCore({
        themes: [
            // instead of strings, you need to pass the imported module
            nord,
            // or a dynamic import if you want to do chunk splitting
            import("shikiji/themes/github-light.mjs"),
        ],
        langs: [import("shikiji/langs/javascript.mjs"), import("shikiji/langs/typescript.mjs")],
        loadWasm: getWasmInlined,
    });

    const traces = parseStacktrace(error);

    let tabs: { html: string; type: GroupType }[] = [];
    let sourceCode: string[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const [index, trace] of traces.entries()) {
        const defaultSource = `// Unable to load source code for ${trace.file}:${trace.line}:${trace.column}`;

        const source = trace.file ? await getFileSource(trace.file) : undefined;
        const sourceCodeFrame = source
            ? codeFrame(
                  source,
                  {
                      line: trace.line,
                      column: trace.column,
                  },
                  {
                      linesAbove: 10,
                      linesBelow: 10,
                  },
                  {
                      showGutter: false,
                  },
              )
            : defaultSource;

        const code = shiki.codeToHtml(sourceCodeFrame, {
            lang: "javascript",
            theme: "nord",
        });

        let filePath = `${trace.file}:${trace.line}:${trace.column}`;
        const relativeFilePath = filePath.replace(process?.cwd?.() || "", "").replace("file:///", "");

        tabs.push({
            html: `<button type="button" id="source-code-tabs-item-${index}" data-hs-tab="#source-code-tabs-${index}" aria-controls="source-code-tabs-${index}" class="hs-tab-active:font-semibold hs-tab-active:border-blue-600 hs-tab-active:text-blue-600 inline-flex items-center gap-x-2 border-b border-gray-100 last:border-transparent text-sm whitespace-nowrap text-gray-500 hover:text-blue-600 disabled:opacity-50 disabled:pointer-events-none dark:text-gray-400 dark:hover:text-blue-500 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600 p-6 ${
                index === 0 ? "active" : ""
            }" role="tab">
    <div class="flex flex-col w-full text-left">
        <span class="text-gray-900 dark:text-gray-100 font-medium">${trace.methodName}</span>
        <span class="text-gray-500 dark:text-gray-400 text-sm break-words">${relativeFilePath}</span>
    </div>
</button>`,
            type: trace.file ? getType(trace.file) : undefined,
        });

        sourceCode.push(`<div id="source-code-tabs-${index}" class="${
            index === 0 ? "block" : "hidden"
        }" role="tabpanel" aria-labelledby="source-code-tabs-item-${index}">
<div class="pt-4 pb-10 text-sm text-right text-[#D8DEE9] dark:text-gray-400"><button id="source-code-open-in-editor" type="button">${relativeFilePath}</button></div>
${code}
</div>`);
    }

    return `<section class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-gradient-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20 mt-6">
    <main id="stack-trace-viewer" class="flex flex-row">
        <div class="w-4/12 rounded-tl-lg rounded-bl-lg overflow-hidden">
            <div class="border-b border-gray-100 p-6">
                <button type="button" class="py-2 px-2 w-full inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-slate-900 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600">
                  <span class="flex flex-row gap-4">${unfoldVerticalIcon} Expand node_modules frames</span>
                  <span class="hidden">${foldVerticalIcon} Collapse node_modules frames</span>
                </button>
            </div>
            <nav class="flex flex-col" aria-label="Tabs" role="tablist">
                ${groupSimilarTypes(tabs)
                    .map((tab) => {
                        if (Array.isArray(tab)) {
                            return `<button type="button" class="hs-collapse-toggle py-3 px-6 border-b border-gray-100 inline-flex items-center gap-x-2 text-sm disabled:opacity-50 disabled:pointer-events-none dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600" id="hs-${
                                (tab[0] as Item).type
                            }" data-hs-collapse="#hs-${(tab[0] as Item).type}-heading">
${tab.length} ${(tab[0] as Item).type === "internal" ? "internal" : "node_modules"} frames
    <svg class="hs-collapse-open:rotate-180 flex-shrink-0 w-4 h-4 " xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
</button>
<div id="hs-${(tab[0] as Item).type}-heading" class="hs-collapse hidden w-full overflow-hidden transition-[height] duration-300" aria-labelledby="hs-${
                                (tab[0] as Item).type
                            }">
  <div class="flex flex-col">${tab.map((item) => item.html).join("")}</div>
</div>`;
                        }

                        return tab.html;
                    })
                    .join("")}
            </nav>
        </div>
        <div class="w-8/12 bg-[#2e3440ff] rounded-tr-lg rounded-br-lg overflow-hidden p-6">${sourceCode.join("")}</div>
    </main>
</section>`;
};

export default stackTraceViewer;
