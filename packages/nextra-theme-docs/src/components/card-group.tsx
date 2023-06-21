import type { FC, HTMLProps, PropsWithChildren } from "react";

import cn from "../utils/cn";

const CardGroup: FC<PropsWithChildren<HTMLProps<HTMLDivElement> & { cols?: number; style: HTMLProps<HTMLDivElement>["style"] & { "--rows"?: string } }>> = ({
    children,
    cols = 3,
    style,
    className,
    ...properties
}) => (
    <div
        className={cn("nextra-cards not-prose mt-4 gap-4", className)}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...properties}
        style={{
            "--rows": String(cols),
            ...style,
        }}
    >
        {children}
    </div>
);

export default CardGroup;
