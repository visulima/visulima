import NextLink from "next/link";
import next from "next/package.json";
import type { ComponentProps, ReactElement } from "react";
import React, { forwardRef } from "react";

import { useConfig } from "../contexts";

type AnchorProperties = Omit<ComponentProps<"a">, "ref"> & {
    newWindow?: boolean;
};

const nextVersion = Number(next.version.split(".")[0]);

const Anchor = forwardRef<HTMLAnchorElement, AnchorProperties>((
    {
        href = "", children, newWindow, ...properties
    },
    // ref is used in <NavbarMenu />
    forwardedReference,
): ReactElement => {
    const config = useConfig();

    if (newWindow) {
        return (
            <a ref={forwardedReference} href={href} target="_blank" rel="noreferrer" {...properties}>
                {children}
            </a>
        );
    }

    if (!href) {
        return (
            <a ref={forwardedReference} {...properties}>
                {children}
            </a>
        );
    }

    if (nextVersion > 12 || config.newNextLinkBehavior) {
        return (
            <NextLink ref={forwardedReference} href={href} {...properties}>
                {children}
            </NextLink>
        );
    }

    return (
        <NextLink href={href} passHref>
            <a ref={forwardedReference} {...properties}>
                {children}
            </a>
        </NextLink>
    );
});

export default Anchor;
