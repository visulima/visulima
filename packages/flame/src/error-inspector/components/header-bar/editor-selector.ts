import { Editor } from "../../../types";
// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?raw";

// Utility function to properly encode SVG content for CSS mask-image
const svgToDataUrl = (svgContent: string): string => {
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

const editorSelector = (editor?: Editor): string => {
    let options = `<option value="">Auto-detected Editor</option>`;

    (Object.keys(Editor) as (keyof typeof Editor)[]).forEach((editorName) => {
        const isSelected = editor && String(editor) === String(editorName);
        options += `<option value="${String(editorName)}" ${isSelected ? "selected" : ""}>${Editor[editorName]}</option>`;
    });

    // Properly encoded chevron icon SVG from lucide-static
    const chevronIcon = svgToDataUrl(chevronDownIcon);

    const selectOptions = `{
    "placeholder": "Auto-detected Editor",
    "toggleClasses": "select-disabled:pointer-events-none select-disabled:opacity-50 relative py-3 px-4 pe-9 flex text-nowrap w-56 cursor-pointer bg-[var(--flame-surface)] border border-[var(--flame-border)] rounded-[var(--flame-radius-md)] text-start text-sm text-[var(--flame-text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--flame-red-orange)] before:absolute before:inset-0 before:z-1",
    "dropdownClasses": "mt-2 z-50 w-full max-h-[300px] p-1 space-y-0.5 bg-[var(--flame-surface)] border border-[var(--flame-border)] rounded-[var(--flame-radius-md)] overflow-hidden overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-lg [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-500",
    "optionClasses": "py-2 px-4 w-full text-sm text-[var(--flame-text)] cursor-pointer hover:bg-[var(--flame-hover-overlay)] rounded-[var(--flame-radius-md)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)]",
    "toggleTag": "<button type=\\"button\\"></button>",
    "optionTemplate": "<div class=\\"flex justify-between items-center w-full\\\"><span data-title></span><span class=\\"hidden selected:block\\\"><span class=\\"dui shrink-0 w-3.5 h-3.5 text-[var(--flame-red-orange)]\\\" style=\\"-webkit-mask-image:url('${svgToDataUrl(checkIcon)}'); mask-image:url('${svgToDataUrl(checkIcon)}')\\\"></span></span></div>"
}`;

    return `<div class="relative" ${!editor ? "hidden" : ""}>
    <select id="editor-selector" data-select='${selectOptions.trim()}'  class="relative py-3 px-4 flex appearance-none overflow-t text-nowrap w-56 bg-[var(--flame-surface)] border border-[var(--flame-border)] rounded-[var(--flame-radius-md)] text-start text-sm text-[var(--flame-text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--flame-red-orange)]">
        ${options}
    </select>
    <div class="absolute top-1/2 end-3 -translate-y-1/2 bg-[var(--flame-surface)]">
        <span class="dui w-3.5 h-3.5" style="-webkit-mask-image:url('${chevronIcon}'); mask-image:url('${chevronIcon}')"></span>
    </div>
</div>`;
};

export default editorSelector;
