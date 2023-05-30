import cn from "clsx";
import type {
    FC, PropsWithChildren, ReactElement, ReactNode,
} from "react";
import {
    createContext, memo, useCallback, useContext, useState,
} from "react";

const context = createContext(0);

function useIndent() {
    return useContext(context);
}

interface FolderProperties {
    name: string;
    label?: ReactElement;
    open?: boolean;
    defaultOpen?: boolean;
    onToggle?: (open: boolean) => void;
    children: ReactNode;
}

interface FileProperties {
    name: string;
    label?: ReactElement;
    active?: boolean;
}

const Tree: FC<PropsWithChildren> = ({ children }) => (
    <div className="mt-6 select-none text-sm text-gray-800 dark:text-gray-300">
        <div className="inline-flex flex-col rounded-lg border px-4 py-2 dark:border-neutral-800">{children}</div>
    </div>
);

const Ident = (): ReactElement => {
    const indent = useIndent();

    return (
        <>
            {/* eslint-disable-next-line unicorn/no-new-array */}
            {new Array(indent).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <span className="inline-block w-5" key={index} />
            ))}
        </>
    );
};

const Folder: FC<FolderProperties> = memo<FolderProperties>(({
    label, name, open, children, defaultOpen = false, onToggle,
}: FolderProperties) => {
    const indent = useIndent();
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const toggle = useCallback(() => {
        onToggle?.(!isOpen);
        setIsOpen(!isOpen);
    }, [isOpen, onToggle]);

    const isFolderOpen = open === undefined ? isOpen : open;

    return (
        <li className="flex list-none flex-col">
            <button type="button" onClick={toggle} title={name} className="inline-flex cursor-pointer items-center py-1 hover:opacity-60">
                <Ident />
                <svg width="1em" height="1em" viewBox="0 0 24 24">
                    <path
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={
                            isFolderOpen
                                // eslint-disable-next-line max-len
                                ? "M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1M5 19h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2Z"
                                : "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2Z"
                        }
                    />
                </svg>
                <span className="ml-1">{label ?? name}</span>
            </button>
            {isFolderOpen && (
                <ul>
                    <context.Provider value={indent + 1}>{children}</context.Provider>
                </ul>
            )}
        </li>
    );
});
Folder.displayName = "Folder";

const File: FC<FileProperties> = memo<FileProperties>(({ label, name, active }: FileProperties) => (
    <li className={cn("flex list-none", active && "text-primary-600 contrast-more:underline")}>
        <button type="button" className="inline-flex cursor-default items-center py-1">
            <Ident />
            <svg width="1em" height="1em" viewBox="0 0 24 24">
                <path
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
                />
            </svg>
            <span className="ml-1">{label ?? name}</span>
        </button>
    </li>
));
File.displayName = "File";

const FileTree = Object.assign(Tree, { Folder, File });

export default FileTree;
