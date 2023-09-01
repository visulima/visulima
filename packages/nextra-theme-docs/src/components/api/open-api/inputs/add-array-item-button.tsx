import type { FC } from "react";
import PlusIcon from "../../../../icons/plus";

const AddArrayItemButton: FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        className="flex w-full flex-row rounded border border-slate-200 bg-white px-2 py-0.5 text-left text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-white/5 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-white/10"
        onClick={onClick}
        type="button"
    >
        <span className="grow">Add Item</span>
        <PlusIcon className="pointer-events-none mt-0.5 h-4 w-4 text-slate-600 dark:text-slate-200" />
    </button>
);

export default AddArrayItemButton;
