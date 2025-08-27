import type { VisulimaError } from "@visulima/error/error";
import DOMPurify from "isomorphic-dompurify";

import type { SolutionError, SolutionFinder } from "../types";
import headerBar from "./components/header-bar";
import type { HeaderTab } from "./components/header-tabs";
import { headerTabs } from "./components/header-tabs";
import { createStackPage } from "./page/stack";
import inlineCss from "./index.css";
import layout from "./layout";
import preline from "../../node_modules/preline/dist/preline.js?raw";
import clipboard from "../../node_modules/clipboard/dist/clipboard.min.js?raw";
import prelineClipboard from "../../node_modules/preline/dist/helper-clipboard.js?raw";
import type { TemplateOptions } from "./types";

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

const template = async (error: ErrorType, solutionFinders: SolutionFinder[] = [], options: TemplateOptions = {}): Promise<string> => {
    let html = "";

    const {
        code: { html: stackHtml, script: stackScript },
        id: stackId,
        name: stackName,
    } = await createStackPage(error, solutionFinders, options);

    const customPages = Array.isArray(options.content) ? options.content : [];
    const anyCustomSelected = customPages.some((p) => p.defaultSelected);
    const tabsList: HeaderTab[] = [];

    tabsList.push({ id: stackId, name: stackName, selected: !anyCustomSelected });

    for (const page of customPages) {
        const safeId = DOMPurify.sanitize(page.id);
        const safeName = DOMPurify.sanitize(String(page.name));

        tabsList.push({ id: safeId, name: safeName, selected: Boolean(page.defaultSelected) });
    }

    html += `<div class="flex flex-row gap-6 w-full mb-6">`;
    html += headerTabs(tabsList);

    const { html: headerBarHtml, script: headerBarScript } = headerBar(options);

    html += headerBarHtml;
    html += `</div>`;
    html += `<div id="flame-section-stack" class="${anyCustomSelected ? "hidden relative" : "relative"}" role="tabpanel" aria-labelledby="flame-tab-stack">${stackHtml}</div>`;

    for (const page of customPages) {
        const hidden = page.defaultSelected ? "" : " hidden";

        html += `<div id="flame-section-${page.id}" class="${hidden} relative" role="tabpanel" aria-labelledby="flame-tab-${page.id}">${page.code.html}</div>`;
    }

    return layout({
        content: html.trim(),
        css: inlineCss.trim(),
        description: "Error",
        error,
        scripts: [clipboard, preline, prelineClipboard, prelineInit, headerBarScript, stackScript as string, ...customPages.map((p) => p.code.script || "")],
        title: "Error",
    });
};

export default template;
