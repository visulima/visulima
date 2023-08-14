import type { FC } from "react";

const AddArrayItemButton: FC<{ onClick: () => void }> = ({ onClick }) => (
    // pointer-events-none on the plus sign SVG is needed to allow clicking the button underneath.
    // Without it, you can't click on the button when hovering over the plus sign.
    <div className="relative">
        <button
            className="dark:bg-dark-input w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-left text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            onClick={onClick}
            type="button"
        >
            Add Item
        </button>
        <svg
            className="pointer-events-none absolute right-2 top-[7px] hidden h-3 fill-slate-500 dark:fill-slate-400 sm:block"
            viewBox="0 0 448 512"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
        </svg>
    </div>
);

export default AddArrayItemButton;
