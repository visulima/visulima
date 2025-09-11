import Editors from "../../../../../../shared/utils/editors";

const editorSelector = (editor?: Editors): string => {
    let options = `<option value="">Auto-detected Editor</option>`;

    (Object.keys(Editors) as (keyof typeof Editors)[]).forEach((editorName) => {
        const isSelected = editor && String(editor) === String(editorName);

        options += `<option value="${String(editorName)}" ${isSelected ? "selected" : ""}>${Editors[editorName]}</option>`;
    });

    return `<div class="relative inline-block">
  <label for="editor-selector" class="sr-only">Editor</label>
  <select id="editor-selector" class="peer py-2 px-3 pe-9 block w-56 bg-[var(--ono-surface)] border border-[var(--ono-border)] rounded-[var(--ono-radius-md)] text-sm text-[var(--ono-text)] shadow-[var(--ono-elevation-1)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:ring-1 focus:ring-[var(--ono-red-orange)]">
    ${options}
  </select>
</div>`;
};

export default editorSelector;
