import type { VisulimaError } from "@visulima/error/error";
import { parseStacktrace } from "@visulima/error/stacktrace";
// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import closeIcon from "lucide-static/icons/x.svg?raw";
import { parse } from "marked";
import DOMPurify from "isomorphic-dompurify";

import errorHintFinder from "../../../solution/error-hint-finder";
import ruleBasedFinder from "../../../solution/rule-based-finder";
import type { Solution, SolutionError, SolutionFinder } from "../../../types";
import debugLog from "../../../util/debug-log";
import findLanguageBasedOnExtension from "../../../util/find-language-based-on-extension";
import getFileSource from "../../../util/get-file-source";

const solutions = async (
    error: Error | SolutionError | VisulimaError,
    solutionFinders: SolutionFinder[],
): Promise<{
    html: string;
    script: string;
}> => {
    let hint: Solution | undefined;

    solutionFinders.push(ruleBasedFinder, errorHintFinder);

    const firstTrace = parseStacktrace(error, { frameLimit: 1 })[0] as any;

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
            file: firstTrace?.file ?? "",
            language: findLanguageBasedOnExtension(firstTrace?.file ?? ""),
            line: firstTrace?.line ?? 0,
            snippet: firstTrace?.file ? await getFileSource(firstTrace.file) : "",
        });
    }

    if (!hint) {
        return {
            html: "",
            script: "",
        };
    }

    return {
        html: `<div id="flame-solution-wrapper" class="relative w-full transition-all duration-300 ease-in-out overflow-visible">
    <button id="flame-solution-button" type="button" aria-label="Toggle solutions" aria-controls="flame-solution-content" aria-expanded="true" class="bg-green-300 dark:bg-green-900/40 rounded-lg p-2 absolute top-2 right-2 z-10 h-9 w-8 cursor-pointer">
        <span id="flame-solution-icon" class="dui" style="-webkit-mask-image: url('${closeIcon}'); mask-image: url('${closeIcon}')"></span>
    </button>
    <div id="flame-solution-content" role="region" aria-label="Suggested solutions" tabindex="-1" class="bg-green-300 dark:bg-green-900/40 rounded-r-lg shadow-2xl shadow-gray-500/20 w-full h-full overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out opacity-100">
        <div class="p-6 prose prose-sm prose-ul:list-none prose-hr:my-6 prose-hr:border-green-400 max-w-full relative" aria-live="polite">
            ${await (async () => {
                if (!hint.header) {
                    return "<h2>A possible solution to this error</h2>";
                }

                const parsedHeader = await parse(hint.header);

                return DOMPurify.sanitize(String(parsedHeader));
            })()}
            ${await (async () => {
                const parsedBody = await parse(hint.body);

                return DOMPurify.sanitize(String(parsedBody));
            })()}
        </div>
    </div>
</div>`,
        script: `(window.subscribeToDOMContentLoaded || function (fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); })(function () {
        var wrapper = document.querySelector('#flame-solution-wrapper');
        var button = document.querySelector('#flame-solution-button');
        var content = document.querySelector('#flame-solution-content');
        var icon = document.getElementById('flame-solution-icon');

        function setIcon(isOpen) {
          var iconUrl = isOpen ? '${closeIcon}' : '${infoIcon}';
          if (icon) {
            icon.style.webkitMaskImage = 'url(' + iconUrl + ')';
            icon.style.maskImage = 'url(' + iconUrl + ')';
          }
        }

        var isOpen = true;

        function setOpenState(nextOpen) {
          isOpen = !!nextOpen;
          
          setIcon(isOpen);
          
          if (!wrapper || !content) {
              return;
          }

          if (isOpen) {
            wrapper.classList.add('w-full');
            wrapper.classList.remove('w-12');
            
            // expand: from current maxHeight to scrollHeight, then clear to allow natural height
            content.classList.remove('opacity-0');
            content.classList.add('opacity-100');

            try { button.setAttribute('aria-expanded', 'true'); } catch (_) {}

            afterTransition(content, function(){
                content.style.maxHeight = 'none';
                try { content.focus(); } catch (_) {}
            });
          } else {
            wrapper.classList.remove('w-full');
            wrapper.classList.add('w-12');
            // collapse: set to current height then animate to 0
            var current = content.scrollHeight;
            content.style.maxHeight = current + 'px';
            // force reflow
            void content.offsetHeight;
            content.classList.remove('opacity-100');
            content.classList.add('opacity-0');
            content.style.maxHeight = '0px';
            try { button.setAttribute('aria-expanded', 'false'); } catch (_) {}
          }
        }

        if (wrapper) {
            wrapper.classList.add('w-full');
        }
        
        if (content) {
          content.classList.remove('opacity-0');
          content.classList.add('opacity-100');
          content.style.maxHeight = 'none';
        }

        setIcon(true);

        if (button) {
          button.addEventListener('click', function () {
            setOpenState(!isOpen);
          });
          button.addEventListener('keydown', function (e) {
            if (e && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setOpenState(!isOpen);
            }
          });
        }
        });`,
    };
};

export default solutions;
