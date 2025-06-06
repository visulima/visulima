import { Editor } from "../../../types";

const editorSelector = (editor?: Editor): string => {
    let options = `<option value="">Auto-detected Editor</option>`;

    Object.keys(Editor).forEach((editorName) => {
        options += `<option value="${editorName}" ${editor === editorName ? "selected" : ""}>${Editor[editorName]}</option>`;
    });

    const selectOptions = `{
    "placeholder": "Auto-detected Editor",
    "toggleClasses": "hs-select-disabled:pointer-events-none hs-select-disabled:opacity-50 relative py-3 px-4 pe-9 flex text-nowrap w-56 cursor-pointer bg-white border border-gray-200 rounded-lg text-start text-sm focus:border-blue-500 focus:ring-blue-500 before:absolute before:inset-0 before:z-1 dark:bg-slate-900 dark:border-gray-700 dark:text-gray-400 dark:focus:outline-hidden dark:focus:ring-1 dark:focus:ring-gray-600",
    "dropdownClasses": "mt-2 z-50 w-full max-h-[300px] p-1 space-y-0.5 bg-white border border-gray-200 rounded-lg overflow-hidden overflow-y-auto dark:bg-slate-900 dark:border-gray-700 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-lg [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-track]:bg-slate-700 dark:[&::-webkit-scrollbar-thumb]:bg-slate-500",
    "optionClasses": "py-2 px-4 w-full text-sm text-gray-800 cursor-pointer hover:bg-gray-100 rounded-lg focus:outline-hidden focus:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-gray-200 dark:focus:bg-slate-800",
    "toggleTag": "<button type=\\"button\\"></button>",
    "optionTemplate": "<div class=\\"flex justify-between items-center w-full\\"><span data-title></span><span class=\\"hidden hs-selected:block\\"><svg class=\\"shrink-0 w-3.5 h-3.5 text-blue-600 dark:text-blue-500\\" xmlns=\\"http:.w3.org/2000/svg\\" width=\\"24\\" height=\\"24\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><polyline points=\\"20 6 9 17 4 12\\"/></svg></span></div>"
}`;

    return `<div class="relative">
    <select id="editor-selector" data-hs-select='${selectOptions.trim()}'  class="relative py-3 px-4 flex appearance-none overflow-t text-nowrap w-56 bg-white border border-gray-200 rounded-lg text-start text-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-900 dark:border-gray-700 dark:text-gray-400 dark:focus:outline-hidden dark:focus:ring-1 dark:focus:ring-gray-600">
        ${options}
    </select>
    <div class="absolute top-1/2 end-3 -translate-y-1/2 bg-white">
        <svg class="shrink-0 w-3.5 h-3.5 text-gray-500 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
    </div>
</div>`;
};

export default editorSelector;
