import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";

/**
 * Metadata about the current page state, passed to the render-prop children.
 */
export type PageMeta = {
    readonly currentPage: number;
    readonly endIndex: number;
    readonly isFirstPage: boolean;
    readonly isLastPage: boolean;
    readonly startIndex: number;
    readonly totalPages: number;
};

export type Props<T> = {
    /**
     * Render-prop that receives the current page items and page metadata.
     */
    readonly children: (pageItems: ReadonlyArray<T>, meta: PageMeta) => ReactNode;

    /**
     * Uncontrolled initial page (0-indexed).
     * @default 0
     */
    readonly defaultPage?: number;

    /**
     * Color for the active page indicator.
     * @default "cyan"
     */
    readonly indicatorColor?: string;

    /**
     * Whether keyboard navigation is active.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * The full list of items to paginate.
     */
    readonly items: ReadonlyArray<T>;

    /**
     * Called when the page changes.
     */
    readonly onChange?: (page: number) => void;

    /**
     * Controlled current page (0-indexed). When provided, the component is controlled.
     */
    readonly page?: number;

    /**
     * Number of items per page.
     */
    readonly pageSize: number;

    /**
     * Indicator style.
     * - `"dots"`: `● ○ ○ ○`
     * - `"numeric"`: `‹ 1 / 4 ›`
     * - `"fraction"`: `1/4`
     * @default "dots"
     */
    readonly style?: "dots" | "fraction" | "numeric";
};

/**
 * Paginator component with render-prop children and a page indicator.
 *
 * ```tsx
 * &lt;Paginator items={allItems} pageSize={5}>
 *   {(pageItems, meta) => (
 *     &lt;Box flexDirection="column">
 *       {pageItems.map((item, i) => &lt;Text key={i}>{item}&lt;/Text>)}
 *     &lt;/Box>
 *   )}
 * &lt;/Paginator>
 * ```
 */
const Indicator = ({
    color,
    currentPage,
    style,
    totalPages,
}: {
    color: string;
    currentPage: number;
    style: "dots" | "fraction" | "numeric";
    totalPages: number;
}): ReactElement => {
    if (style === "fraction") {
        return (
            <Text>
                <Text color={color}>{currentPage + 1}</Text>
                <Text dimColor>
/
{totalPages}
                </Text>
            </Text>
        );
    }

    if (style === "numeric") {
        const previousArrow = currentPage > 0 ? <Text color={color}>{"\u2039 "}</Text> : <Text dimColor>{"\u2039 "}</Text>;
        const nextArrow = currentPage < totalPages - 1 ? <Text color={color}>{" \u203A"}</Text> : <Text dimColor>{" \u203A"}</Text>;

        return (
            <Box>
                {previousArrow}
                <Text color={color}>{currentPage + 1}</Text>
                <Text dimColor>
{" "}
/
{totalPages}
                </Text>
                {nextArrow}
            </Box>
        );
    }

    // Dots style (default)
    const dots = Array.from({ length: totalPages }, (_, i) => {
        if (i === currentPage) {
            return (
                <Text color={color} key={i}>
                    {"\u25CF"}
                </Text>
            );
        }

        return (
            <Text dimColor key={i}>
                {"\u25CB"}
            </Text>
        );
    });

    return <Box gap={1}>{dots}</Box>;
};

const Paginator = <T,>({
    children,
    defaultPage = 0,
    indicatorColor = "cyan",
    isFocused = true,
    items,
    onChange,
    page: controlledPage,
    pageSize,
    style = "dots",
}: Props<T>): ReactElement => {
    const isControlled = controlledPage !== undefined;
    const [internalPage, setInternalPage] = useState(defaultPage);
    // Use the controlled value directly during render — no effect needed to sync.
    const currentPage = isControlled ? controlledPage : internalPage;

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.max(0, Math.min(currentPage, totalPages - 1));

    const setPage = useCallback(
        (newPage: number) => {
            const clamped = Math.max(0, Math.min(newPage, totalPages - 1));

            if (!isControlled) {
                setInternalPage(clamped);
            }

            onChange?.(clamped);
        },
        [totalPages, isControlled, onChange],
    );

    useInput(
        useCallback(
            (_input: string, key) => {
                if (key.leftArrow || key.pageUp) {
                    setPage(safePage - 1);
                } else if (key.rightArrow || key.pageDown) {
                    setPage(safePage + 1);
                } else if (key.home) {
                    setPage(0);
                } else if (key.end) {
                    setPage(totalPages - 1);
                }
            },
            [safePage, totalPages, setPage],
        ),
        { isActive: isFocused },
    );

    const startIndex = safePage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, items.length);
    const pageItems = items.slice(startIndex, endIndex);

    const meta: PageMeta = {
        currentPage: safePage,
        endIndex,
        isFirstPage: safePage === 0,
        isLastPage: safePage === totalPages - 1,
        startIndex,
        totalPages,
    };

    return (
        <Box flexDirection="column">
            {children(pageItems, meta)}
            {totalPages > 1 && <Indicator color={indicatorColor} currentPage={safePage} style={style} totalPages={totalPages} />}
        </Box>
    );
};

export default Paginator;

export { Paginator };
export type { Props as PaginatorProps };
