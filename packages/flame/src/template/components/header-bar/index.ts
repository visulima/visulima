import type { Editor, Theme } from "../../../types";
import tooltip from "../tooltip";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";

const headerBar = (options: Partial<{ editor: Editor; theme: Theme }>): {
    html: string;
    script: string;
} => {
    const toggle = themeToggle(options.theme);
    const { html: tooltipHtml, script: tooltipScript } = tooltip();

    return {
        html: `<div class="my-4 w-full flex">
    <div class="grow"></div>
    ${editorSelector(options.editor)}
    ${toggle.html}
    ${tooltipHtml}
</div>`,
        script: `
        ${toggle.script}
        ${tooltipScript}
        `,
    };
};

export default headerBar;
