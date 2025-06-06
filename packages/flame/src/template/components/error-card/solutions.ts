import type { Trace, VisulimaError } from "@visulima/error/error";
import { parseStacktrace } from "@visulima/error/stacktrace";
import infoIcon from "lucide-static/icons/info.svg";
import closeIcon from "lucide-static/icons/x.svg";
import { parse } from "marked";
import sanitizeHtml from "sanitize-html";

import errorHintFinder from "../../../solution/error-hint-finder";
import type { Solution, SolutionError, SolutionFinder } from "../../../types";
import debugLog from "../../../util/debug-log";
import findLanguageBasedOnExtension from "../../../util/find-language-based-on-extension";
import getFileSource from "../../../util/get-file-source";

const solutions = async (error: Error | SolutionError | VisulimaError, solutionFinders: SolutionFinder[]): Promise<{
    html: string;
    script: string;
}> => {
    let hint: Solution | undefined;

    solutionFinders.push(errorHintFinder);

    const trace = parseStacktrace(error, {
        frameLimit: 1,
    })[0] as Trace;

    for await (const handler of solutionFinders.sort((a, b) => a.priority - b.priority)) {
        if (hint) {
            break;
        }

        const { handle: solutionHandler, name } = handler;

        debugLog(`Running solution finder: ${name}`);

        if (typeof solutionHandler !== "function") {
            continue;
        }

        hint = await solutionHandler(error, {
            file: trace.file as string,
            language: findLanguageBasedOnExtension(trace.file),
            line: trace.line,
            snippet: await getFileSource(trace.file),
        });
    }

    if (!hint) {
        return {
            html: "",
            script: "",
        };
    }

    return {
        html: `<div id="flame-solution-wrapper" class="px-6 pb-6 relative w-full transition-all">
    <button id="flame-solution-button" type="button" class="bg-green-300 rounded-lg p-2 absolute top-2 right-9 z-10">
        <img src="${closeIcon}" alt="Close" class="w-4 h-4" />
        <img src="${infoIcon}" alt="Info" class="w-4 h-4 hidden" />
    </button>
    <div id="flame-solution-content" class="bg-green-300 rounded-lg shadow-2xl shadow-gray-500/20 overflow-hidden transition-[height] duration-300">
        <div class="hs-collapse p-6 prose prose-sm prose-ul:list-none prose-hr:my-6 prose-hr:border-green-400 max-w-full relative">
            ${hint.header ? `${sanitizeHtml(await parse(hint.header))}` : "<h2>A possible solution to this error</h2>"}
            ${sanitizeHtml(await parse(hint.body))}
        </div>
    </div>
</div>`,
        script: `window.addEventListener('load', () => {
        const wrapper = document.querySelector('#flame-solution-wrapper');
        const button = document.querySelector('#flame-solution-button');
        const content = document.querySelector('#flame-solution-content');

        button.addEventListener('click', () => {
            if (!content.classList.contains('hidden')) {
                content.style.height = content.scrollHeight + "px";

                setTimeout(() => {
                    content.style.height = 0;

                    wrapper.style.paddingBottom = '4rem';
                });

                afterTransition(content, () => {
                    content.classList.add('hidden');
                    content.style.height = 0;
                });
            } else {
                content.classList.remove('hidden');
                content.style.height = '0';

                setTimeout(() => {
                    content.style.height = content.scrollHeight + "px";
                    wrapper.style.paddingBottom = '';
                });
            }

            button.querySelector('.lucide-x').classList.toggle('hidden');
            button.querySelector('.lucide-info').classList.toggle('hidden');
        });
});`,
    };
};

export default solutions;
