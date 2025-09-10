import type { VisulimaError } from "@visulima/error/error";
import type { Solution, SolutionError, SolutionFinder } from "@visulima/error/solution";
import { errorHintFinder, ruleBasedFinder } from "@visulima/error/solution";
import { parseStacktrace } from "@visulima/error/stacktrace";
import DOMPurify from "isomorphic-dompurify";
// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import closeIcon from "lucide-static/icons/x.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import { parse } from "marked";

import findLanguageBasedOnExtension from "../../../../../../shared/utils/find-language-based-on-extension";
import getFileSource from "../../../../../../shared/utils/get-file-source";

const solutions = async (
    error: Error | SolutionError | VisulimaError,
    solutionFinders: SolutionFinder[],
): Promise<{
    html: string;
    script: string;
}> => {
    let hint: Solution | undefined;

    solutionFinders.push(ruleBasedFinder, errorHintFinder);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstTrace = parseStacktrace(error, { frameLimit: 1 })[0] as any;

    for await (const handler of solutionFinders.sort((a, b) => a.priority - b.priority)) {
        if (hint) {
            break;
        }

        const { handle: solutionHandler, name } = handler;

        if (process.env.DEBUG) {
            // eslint-disable-next-line no-console
            console.debug(`Running solution finder: ${name}`);
        }

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
        html: `<div id="ono-solution-wrapper" class="relative w-full transition-all duration-300 ease-in-out overflow-visible">
    <button id="ono-solution-button" type="button" aria-label="Toggle solutions" aria-controls="ono-solution-content" aria-expanded="true" title="Toggle solution details" class="bg-[var(--ono-success-bg)] text-[var(--ono-text)] rounded-[var(--ono-radius-md)] p-2 absolute top-2 right-2 z-10 h-9 w-8 cursor-pointer shadow-[var(--ono-elevation-1)]">
        <span id="ono-solution-icon" class="dui" style="-webkit-mask-image: url('${closeIcon}'); mask-image: url('${closeIcon}')"></span>
    </button>
    <div id="ono-solution-content" role="region" aria-label="Suggested solutions" tabindex="-1" class="bg-[var(--ono-success-bg)] rounded-r-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] w-full h-full overflow-hidden transition-[max-height,opacity] duration-150 ease-in-out opacity-100">
        <div class="p-6 prose prose-sm prose-headings:text-white prose-ul:list-none prose-hr:my-6 prose-hr:border-[var(--ono-success-border)] max-w-full relative text-[var(--ono-on-accent)]" aria-live="polite">
            ${await (async () => {
                if (!hint.header) {
                    return "<h2 class='text-[var(--ono-on-accent)]'>A possible solution to this error</h2>";
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
        script: `(window.subscribeToDOMContentLoaded || function (fn) {
          if (document.readyState !== 'loading') fn();
          else document.addEventListener('DOMContentLoaded', fn);
        })(function () {
          // Get DOM elements
          const wrapper = document.querySelector('#ono-solution-wrapper');
          const button = document.querySelector('#ono-solution-button');
          const content = document.querySelector('#ono-solution-content');
          const icon = document.getElementById('ono-solution-icon');

          // Validate required elements exist
          if (!wrapper || !button || !content || !icon) {
            console.warn('Solution toggle elements not found');
            return;
          }

          // State management
          let isOpen = true;

          // Icon management
          const setIcon = (isOpen) => {
            const iconUrl = isOpen ? '${closeIcon}' : '${infoIcon}';
            icon.style.webkitMaskImage = \`url(\${iconUrl})\`;
            icon.style.maskImage = \`url(\${iconUrl})\`;
          };

          // Animation utilities
          const afterTransition = (element, callback) => {
            const handleTransitionEnd = () => {
              element.removeEventListener('transitionend', handleTransitionEnd);
              callback();
            };
            element.addEventListener('transitionend', handleTransitionEnd);
          };

          // State management
          const setOpenState = (nextOpen) => {
            isOpen = Boolean(nextOpen);

            // Update icon
            setIcon(isOpen);

            if (isOpen) {
              // Expand: show full content
              wrapper.classList.add('w-full');
              wrapper.classList.remove('w-12');

              content.classList.remove('opacity-0');
              content.classList.add('opacity-100');

              button.setAttribute('aria-expanded', 'true');

              // Clear height constraint after transition
              afterTransition(content, () => {
                content.style.maxHeight = 'none';
                content.focus();
              });
            } else {
              // Collapse: hide content with smooth animation
              wrapper.classList.remove('w-full');
              wrapper.classList.add('w-12');

              // Animate height from current to 0
              const currentHeight = content.scrollHeight;
              content.style.maxHeight = \`\${currentHeight}px\`;

              // Force reflow for smooth animation
              content.offsetHeight;

              // Fade out and collapse
              content.classList.remove('opacity-100');
              content.classList.add('opacity-0');
              content.style.maxHeight = '0px';

              button.setAttribute('aria-expanded', 'false');
            }
          };

          // Initialize state
          const initialize = () => {
            wrapper.classList.add('w-full');
            content.classList.remove('opacity-0');
            content.classList.add('opacity-100');
            content.style.maxHeight = 'none';
            setIcon(true);
          };

          // Event handlers
          const handleClick = () => setOpenState(!isOpen);

          const handleKeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenState(!isOpen);
            }
          };

          // Initialize
          initialize();

          // Add event listeners
          button.addEventListener('click', handleClick);
          button.addEventListener('keydown', handleKeydown);
        });`,
    };
};

export default solutions;
