/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type TagVariant = "outline" | "solid" | "subtle";

export type Props = {
    /**
     * Tag content.
     */
    readonly children: ReactNode;

    /**
     * Base color.
     * @default "blue"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Optional symbol rendered before the label (e.g. `●`, `✔`, `★`).
     */
    readonly icon?: ReactNode;

    /**
     * Visual style.
     * @default "subtle"
     */
    readonly variant?: TagVariant;
};

/**
 * Render a short pill-shaped label.
 * @returns A `ReactElement` rendering the tag in the requested variant.
 */
export default function Tag({ children, color = "blue", icon, variant = "subtle" }: Props): ReactElement {
    if (variant === "outline") {
        return (
            <Box borderColor={color} borderStyle="round" paddingX={1}>
                <Text color={color}>
                    {icon === undefined ? undefined : <>{icon} </>}
                    {children}
                </Text>
            </Box>
        );
    }

    if (variant === "solid") {
        return (
            <Text backgroundColor={color} color="black">
                {" "}
                {icon === undefined ? undefined : <>{icon} </>}
                {children}{" "}
            </Text>
        );
    }

    return (
        <Text color={color}>
            {icon === undefined ? undefined : <>{icon} </>}
            {children}
        </Text>
    );
}

export { Tag };
export type { Props as TagProps };
