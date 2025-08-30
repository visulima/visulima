import { Editor } from "../../../types";

const editorSelector = (editor?: Editor): string => {
    let options = `<option value=\"\">Auto-detected Editor</option>`;

    (Object.keys(Editor) as (keyof typeof Editor)[]).forEach((editorName) => {
        const isSelected = editor && String(editor) === String(editorName);
        options += `<option value=\"${String(editorName)}\" ${isSelected ? "selected" : ""}>${Editor[editorName]}</option>`;
    });

    return `<div class=\"relative inline-block\">
  <label for=\"editor-selector\" class=\"sr-only\">Editor</label>
  <select id=\"editor-selector\" class=\"peer py-2 px-3 pe-9 block w-56 bg-[var(--flame-surface)] border border-[var(--flame-border)] rounded-[var(--flame-radius-md)] text-sm text-[var(--flame-text)] shadow-[var(--flame-elevation-1)] hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:ring-1 focus:ring-[var(--flame-red-orange)]\">
    ${options}
  </select>
</div>`;
};

export default editorSelector;
