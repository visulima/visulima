import type { VisulimaError } from "@visulima/error/error";
import { getErrorCauses } from "@visulima/error/error";

import type { DisplayerOptions, SolutionError, SolutionFinder } from "../types";
import headerBar from "./components/header-bar";
import tabsHeader, { type Tab } from "./components/tabs";
import buildStackContent from "./content/stack";
import inlineCss from "./index.css";
import layout from "./layout";
import preline from "../../node_modules/preline/dist/preline.js?raw";
import clipboard from "../../node_modules/clipboard/dist/clipboard.min.js?raw";
import prelineClipboard from "../../node_modules/preline/dist/helper-clipboard.js?raw";

// Preline initialization script - only initialize components we actually use
const prelineInit = `
(function() {
  // Initialize only specific Preline UI components
  (window.subscribeToDOMContentLoaded || function (fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  })(function () {
    if (typeof HSStaticMethods !== 'undefined' && HSStaticMethods.autoInit) {
      // Only initialize components we actually use:
      // - tooltip: for copy buttons and shortcuts popover
      // - clipboard: for copy functionality  
      // - theme-appearance: for dark/light mode switching
      // - tabs: for header navigation tabs
      HSStaticMethods.autoInit(['tooltip', 'clipboard', 'theme-appearance', 'tabs']);
    }
    
    // Explicitly initialize clipboard if available
    if (typeof HSClipboard !== 'undefined' && HSClipboard.init) {
      HSClipboard.init();
    }
  });
})();
`;

type ErrorType = Error | SolutionError | VisulimaError;

const template = async (error: ErrorType, solutionFinders: SolutionFinder[] = [], options: DisplayerOptions = {}): Promise<string> => {
    const allCauses = getErrorCauses(error);

    if (allCauses.length === 0) {
        throw new Error("No error causes found");
    }

    const [mainCause, ...causes] = allCauses;

    let html = "";

    const { html: stackHtml, scripts: stackScripts } = await buildStackContent(mainCause as ErrorType, causes as Error[], solutionFinders);

    const customPages = Array.isArray(options.content) ? options.content : [];
    const anyCustomSelected = customPages.some((p) => p.defaultSelected);
    const tabs: Tab[] = [];

    tabs.push({ id: "stack", name: "Stack", selected: !anyCustomSelected });

    for (const page of customPages) {
        tabs.push({ id: page.id, name: page.name, selected: Boolean(page.defaultSelected) });
    }

    html += `<div class="flex flex-row gap-6 w-full mb-6">`;

    const tabsUi = tabsHeader(tabs);

    html += tabsUi.html;

    const { html: headerBarHtml, script: headerBarScript } = headerBar(options);

    html += headerBarHtml;

    html += `</div>`;

    html += `<div id="flame-section-stack" class="${anyCustomSelected ? "hidden" : ""}" role="tabpanel" aria-labelledby="flame-tab-stack">${stackHtml}</div>`;

    for (const page of customPages) {
        const hidden = page.defaultSelected ? "" : " hidden";

        html += `<div id="flame-section-${page.id}" class="${hidden}" role="tabpanel" aria-labelledby="flame-tab-${page.id}">${page.code.html}</div>`;
    }

    return layout({
        content: html.trim(),
        css: inlineCss.trim(),
        description: "Error",
        error: mainCause as ErrorType,
        scripts: [
            clipboard,
            preline,
            prelineClipboard,
            prelineInit,
            headerBarScript,
            tabsUi.script,
            ...stackScripts,
            ...customPages.map((p) => p.code.script || ""),
        ],
        title: "Error",
    });
};

export default template;
