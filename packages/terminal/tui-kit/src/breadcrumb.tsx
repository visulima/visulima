/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement, ReactNode } from "react";
import { Fragment } from "react";
import type { LiteralUnion } from "type-fest";

export type BreadcrumbItem = {
    readonly icon?: ReactNode;
    readonly key?: string;
    readonly label: string;
};

export type Props = {
    /**
     * Color applied to the trailing (current) item.
     * @default "blue"
     */
    readonly currentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Items to display from root to current page.
     */
    readonly items: ReadonlyArray<BreadcrumbItem>;

    /**
     * Glyph rendered between adjacent items.
     * @default "›" (right single angle quote)
     */
    readonly separator?: string;
};

/**
 * Render a breadcrumb trail (last item is highlighted).
 */
export default function Breadcrumb({ currentColor = "blue", items, separator = "›" }: Props): ReactElement {
    return (
        <Box>
            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <Fragment key={item.key ?? item.label}>
                        {index > 0
                            ? (
<Text dimColor>
{" "}
{separator}
{" "}
</Text>
                            )
                            : undefined}
                        <Text bold={isLast} color={isLast ? currentColor : undefined} dimColor={!isLast}>
                            {item.icon === undefined
                                ? undefined
                                : (
<>
{item.icon}
{" "}
</>
                                )}
                            {item.label}
                        </Text>
                    </Fragment>
                );
            })}
        </Box>
    );
}

export { Breadcrumb };
export type { Props as BreadcrumbProps };
