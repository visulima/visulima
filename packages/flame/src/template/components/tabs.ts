type Tab = { id: string; name: string; selected?: boolean };

const tabsHeader = (tabs: Tab[]): { html: string; script: string } => {
    const html = `<nav class="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700" role="tablist">
    ${tabs
        .map((t) => {
            const cls = t.selected
                ? "active hs-tab-active:bg-blue-50 hs-tab-active:border-blue-200 hs-tab-active:text-blue-700 bg-blue-50 border-blue-200 text-blue-700 dark:hs-tab-active:bg-blue-900/20 dark:hs-tab-active:border-blue-700 dark:hs-tab-active:text-blue-300 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                : "hs-tab-active:bg-blue-50 hs-tab-active:border-blue-200 hs-tab-active:text-blue-700 bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700 dark:hs-tab-active:bg-blue-900/20 dark:hs-tab-active:border-blue-700 dark:hs-tab-active:text-blue-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:border-gray-500 dark:hover:text-gray-200";

            return `<button type="button" class="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer border transition-all duration-200 ease-in-out ${cls}" id="flame-tab-${t.id}" aria-selected="${t.selected ? "true" : "false"}" data-hs-tab="#flame-section-${t.id}" aria-controls="flame-section-${t.id}" role="tab">${t.name}</button>`;
        })
        .join("")}
  </nav>
`;

    const script = ``;

    return { html, script };
};

export type { Tab };
export default tabsHeader;
