import type { Trace } from "@visulima/error";
import { codeFrame, parseStacktrace } from "@visulima/error";
import aiPrompt from "@visulima/error/solution/ai/prompt";

import findLanguageBasedOnExtension from "../../../../../../shared/utils/find-language-based-on-extension";
import getFileSource from "../../../../../../shared/utils/get-file-source";
import { sanitizeAttribute, sanitizeHtml } from "../../utils/sanitize";
import copyDropdown from "../copy-dropdown";
import shortcutsButton from "../shortcuts-button";

const stickyHeader = async (
    error: Error,
): Promise<{
    html: string;
    script: string;
}> => {
    const safeName = sanitizeHtml(error.name);
    const safeMessage = sanitizeHtml(error.message);
    const safeTitleValue = sanitizeAttribute(`${error.name}: ${error.message}`);

    // Build AI prompt using first stack frame and code frame when available
    const trace = parseStacktrace(error as Error, { frameLimit: 1 })?.[0] as Trace;
    const filePath = trace?.file ?? "";
    const fileLine = trace?.line ?? 0;
    const fileSource = filePath ? await getFileSource(filePath) : "";
    const snippet = fileSource
        ? codeFrame(fileSource, { start: { column: trace?.column, line: fileLine } }, { linesAbove: 9, linesBelow: 10, showGutter: true })
        : "";
    const fixPrompt = aiPrompt({
        applicationType: undefined,
        error: error as Error,
        file: {
            file: filePath,
            language: findLanguageBasedOnExtension(filePath),
            line: fileLine,
            snippet,
        },
    });

    const shortcuts = shortcutsButton();
    const copyDropdownResult = copyDropdown({
        label: "Copy error title",
        secondaryLabel: "Copy fix prompt",
        secondaryText: fixPrompt,
        targetId: "clipboard-sticky-error-title",
    });

    return {
        html: `<div id="error-card-sticky-header" class="fixed invisible container px-6 py-4 -top-40 z-10 rounded-[var(--ono-radius-lg)] transition-all duration-300 shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)]">
  <input type="hidden" id="clipboard-sticky-error-title" value="${safeTitleValue}">
  <div class="flex items-center gap-2">
    <h1 class="text-sm font-semibold py-1 px-2 text-[var(--ono-chip-text)] bg-[var(--ono-chip-bg)] rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)]" aria-label="Error name">${safeName}</h1>
    <span class="text-md font-semibold line-clamp-1 text-[var(--ono-text)]" aria-label="Error message">${safeMessage}</span>
    <div class="grow"></div>
    ${shortcuts.html}
    ${copyDropdownResult.html}
  </div>
</div>`,
        script: `${shortcuts.script}(function() {
  ready(function () {
    bindShortcutsModal();

    const errorCard = document.getElementById("error-card");
    const header = document.getElementById("error-card-sticky-header");

    if (!errorCard || !header) {
      console.warn('Sticky header elements not found');
      return;
    }

    const stickyHeader = () => {
      const bounding = errorCard.getBoundingClientRect();

      if (bounding.bottom <= -15) {
        header.classList.remove("invisible");
        header.classList.remove("-top-40");
        header.classList.add("top-0");
        header.classList.add("visible");
      } else {
        header.classList.remove("top-0");
        header.classList.remove("visible");
        header.classList.add("invisible");
        header.classList.add("-top-40");
      }
    };

    // Initialize sticky header
    stickyHeader();

    // Add scroll listener once
    try {
      if (!window.__onoStickyHeaderBound) {
        window.__onoStickyHeaderBound = true;
        window.addEventListener('scroll', stickyHeader, { passive: true });
      }
    } catch (_) {}
  });
})();`,
    };
};

export default stickyHeader;
