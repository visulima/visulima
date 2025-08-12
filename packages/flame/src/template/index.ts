import type { VisulimaError } from "@visulima/error/error";
import { getErrorCauses } from "@visulima/error/error";

import type { DisplayerOptions, SolutionError, SolutionFinder } from "../types";
import headerBar from "./components/header-bar";
import tabsHeader, { type Tab } from "./components/tabs";
import buildStackContent from "./content/stack";
import inlineCss from "./index.css";
import layout from "./layout";

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

    // Render sections
    html += `<div id=\"flame-section-stack\">${stackHtml}</div>`;

    for (const page of customPages) {
        const hidden = page.defaultSelected ? "" : " hidden";

        html += `<div id=\"flame-section-${page.id}\" class=\"${hidden}\">${page.code.html}</div>`;
    }

    return layout({
        content: html.trim(),
        css: inlineCss.trim(),
        description: "Error",
        error: mainCause as ErrorType,
        scripts: [headerBarScript, tabsUi.script, ...stackScripts, ...customPages.map((p) => p.code.script || "")],
        title: "Error",
    });
};

export default template;

// Helpers for building content pages (public API via '@visulima/flame/template')
export { default as buildContextPage } from "./content/context";
