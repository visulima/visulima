import { codeFrame, parseStacktrace } from "@visulima/error";
import { createHighlighter } from "shiki";

import findLanguageBasedOnExtension from "../../../util/find-language-based-on-extension";
import getFileSource from "../../../util/get-file-source";
import process from "../../../util/process";
import revisionHash from "../../../util/revision-hash";
import type { GroupType, Item } from "./types";
import getType from "./util/get-type";
import groupSimilarTypes from "./util/group-similar-types";

const stackTraceViewer = async (error: Error): Promise<string> => {
    const uniqueKey = revisionHash(error.name + error.message + error.stack);

    const highlighter = await createHighlighter({
        langs: [
            "javascript",
            "typescript",
            "jsx",
            "tsx",
            "json",
            "jsonc",
            "json5",
            "xml",
            "sql",
        ],
        themes: [
            // instead of strings, you need to pass the imported module
            "nord",
            // or a dynamic import if you want to do chunk splitting
            "github-light",
        ],
    });

    const traces = parseStacktrace(error);

    const tabs: { html: string; type: GroupType }[] = [];
    const sourceCode: string[] = [];

    for await (const [index, trace] of traces.entries()) {
        const defaultSource = `// Unable to load source code for ${trace.file}:${trace.line}:${trace.column}`;

        const source = trace.file ? await getFileSource(trace.file) : undefined;
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
        const relativeFilePath = filePath.replace(process.cwd?.() || "", "").replace("file:///", "");

        tabs.push({
            html: `<button type="button" id="source-code-tabs-item-${uniqueKey}-${index}" data-hs-tab="#source-code-tabs-${uniqueKey}-${index}" aria-controls="source-code-tabs-${uniqueKey}-${index}" class="hs-tab-active:font-semibold hs-tab-active:border-blue-600 hs-tab-active:text-blue-600 inline-flex items-center gap-x-2 border-b border-gray-100 last:border-transparent text-sm whitespace-nowrap text-gray-500 hover:text-blue-600 disabled:opacity-50 disabled:pointer-events-none dark:text-gray-400 dark:hover:text-blue-500 dark:focus:outline-hidden dark:focus:ring-1 dark:focus:ring-gray-600 p-6 ${
                index === 0 ? "active" : ""
            }" role="tab">
    <div class="flex flex-col w-full text-left">
        <span class="text-gray-900 dark:text-gray-100 font-medium">${trace.methodName}</span>
        <span class="text-gray-500 dark:text-gray-400 text-sm break-words">${relativeFilePath}</span>
    </div>
</button>`,
            type: trace.file ? getType(trace.file) : undefined,
        });

        sourceCode.push(`<div id="source-code-tabs-${uniqueKey}-${index}" class="${
            index === 0 ? "block" : "hidden"
        }" role="tabpanel" aria-labelledby="source-code-tabs-item-${uniqueKey}-${index}">
<div class="pt-10 pb-8 mb-6 text-sm text-right text-[#D8DEE9] dark:text-gray-400 border-b border-gray-600">
    <div class="px-6">
        <button id="source-code-open-in-editor" type="button">${relativeFilePath}</button>
    </div>
</div>
<div class="p-6">${code}</div>
</div>`);
    }

    return `<section class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-linear-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20">
    <main id="stack-trace-viewer" class="flex flex-row">
        <div class="w-4/12 rounded-tl-lg rounded-bl-lg overflow-hidden">
            <div class="border-b border-gray-100 p-6">
                <span class="block text-xs mb-2 text-gray-500 dark:text-gray-400">Show or Hide collapsed frames</span>
                <div class="flex flex-row items-center">
                ${groupSimilarTypes(tabs)
                    .map((tab: Item | Item[]) => {
                        if (Array.isArray(tab)) {
                            return `<div class="flex items-center">
                            <input type="checkbox" id="hs-small-switch" class="relative w-[35px] h-[21px] bg-gray-100 border-transparent text-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:ring-blue-600 disabled:opacity-50 disabled:pointer-events-none checked:bg-none checked:text-blue-600 checked:border-blue-600 focus:checked:border-blue-600 dark:bg-gray-800 dark:border-gray-700 dark:checked:bg-blue-500 dark:checked:border-blue-500 dark:focus:ring-offset-gray-600 before:inline-block before:w-4 before:h-4 before:bg-white checked:before:bg-blue-200 before:translate-x-0 checked:before:translate-x-full before:rounded-full before:shadow-sm before:transform before:ring-0 before:transition before:ease-in-out before:duration-200 dark:before:bg-gray-400 dark:checked:before:bg-blue-200">
                            <label for="hs-small-switch" class="text-sm text-gray-500 ms-3 dark:text-gray-400">${(tab[0] as Item).type}</label>
                        </div>`;
                        }

                        return "";
                    })
                    .join("")}
                </div>
            </div>
            <nav class="flex flex-col" aria-label="Tabs" role="tablist">
                ${groupSimilarTypes(tabs)
                    .map((tab) => {
                        if (Array.isArray(tab)) {
                            // Cast to Item to satisfy TypeScript, knowing it's an array of Item
                            const firstItem = tab[0] as Item;

                            return `<details class="border-b border-gray-100 dark:border-gray-700">
<summary class="py-3 px-6 cursor-pointer flex items-center justify-between text-sm dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-hidden focus:ring-1 focus:ring-gray-600">
    <span>${tab.length} ${firstItem.type === "internal" ? "internal" : "node_modules"} frames</span>
    <svg class="shrink-0 w-4 h-4 transition-transform duration-300 details-open:rotate-180" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
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
};

export default stackTraceViewer;
