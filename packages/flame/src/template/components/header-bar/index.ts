import type { Editor, Theme } from "../../../types";
import editorSelector from "./editor-selector";
import themeToggle from "./theme-toggle";

const headerBar = (options: Partial<{ editor: Editor; theme: Theme }>): {
    html: string;
    script: string;
} => {
    const toggle = themeToggle(options.theme);

    return {
        html: `<div class="my-4 w-full flex">
    <div class="flex-grow"></div>
    ${editorSelector(options.editor)}
    ${toggle.html}
</div>`,
        script: toggle.script,
    };
};

export default headerBar;
