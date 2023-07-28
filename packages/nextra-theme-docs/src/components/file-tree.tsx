import cn from "clsx";
import type { FC, PropsWithChildren, ReactElement, ReactNode } from "react";
import { createContext, memo, useCallback, useContext, useState } from "react";

const context = createContext(0);

const useIndent = () => useContext(context);

interface FolderProperties {
    children: ReactNode;
    // eslint-disable-next-line react/require-default-props
    defaultOpen?: boolean;
    // eslint-disable-next-line react/require-default-props
    label?: ReactElement;
    name: string;
    // eslint-disable-next-line react/require-default-props
    onToggle?: (open: boolean) => void;
    // eslint-disable-next-line react/require-default-props
    open?: boolean;
}

interface FileProperties {
    // eslint-disable-next-line react/require-default-props
    active?: boolean;
    // eslint-disable-next-line react/require-default-props
    label?: ReactElement;
    name: string;
}

const Tree: FC<PropsWithChildren> = ({ children = undefined }) => (
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

const Folder: FC<FolderProperties> = memo<FolderProperties>(({ children, defaultOpen = false, label, name, onToggle, open }: FolderProperties) => {
    const indent = useIndent();
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const toggle = useCallback(() => {
        onToggle?.(!isOpen);
        setIsOpen(!isOpen);
    }, [isOpen, onToggle]);

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const isFolderOpen = open === undefined ? isOpen : open;

    return (
        <li className="flex list-none flex-col">
            <button className="inline-flex cursor-pointer items-center py-1 hover:opacity-60" onClick={toggle} title={name} type="button">
                <Ident />
                <svg height="1em" viewBox="0 0 24 24" width="1em">
                    <path
                        d={
                            isFolderOpen
                                ? "M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1M5 19h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2Z"
                                : "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2Z"
                        }
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                </svg>
                <span className="ml-1">{label ?? name}</span>
            </button>
            {isFolderOpen && (
                <ul className="my-0.5">
                    <context.Provider value={indent + 1}>{children}</context.Provider>
                </ul>
            )}
        </li>
    );
});
Folder.displayName = "Folder";

const File: FC<FileProperties> = memo<FileProperties>(({ active, label, name }: FileProperties) => (
    <li className={cn("flex list-none m-0", active && "text-primary-600 contrast-more:underline")}>
        <button className="inline-flex cursor-default items-center py-1" type="button">
            <Ident />
            <svg height="1em" viewBox="0 0 24 24" width="1em">
                <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                />
            </svg>
            <span className="ml-1">{label ?? name}</span>
        </button>
    </li>
));
File.displayName = "File";

const FileTree = Object.assign(Tree, { File, Folder });

export default FileTree;
