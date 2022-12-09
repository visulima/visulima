// only in this file we determine either we include <a /> as child of <NextLink /> based of `newNextLinkBehavior` value
// eslint-disable-next-line no-restricted-imports
import NextLink from "next/link";
import next from "next/package.json";
import type { ComponentProps, ReactElement } from "react";
import React, { forwardRef } from "react";

import { useConfig } from "../contexts";

type AnchorProperties = Omit<ComponentProps<"a">, "ref"> & {
    newWindow?: boolean;
};

const nextVersion = Number(next.version.split(".")[0]);

const Anchor = forwardRef<HTMLAnchorElement, AnchorProperties>(
    (
        {
            href = "", children, newWindow, ...properties
        },
        // ref is used in <NavbarMenu />
        forwardedReference,
    ): ReactElement => {
        const config = useConfig();

        if (newWindow) {
            return (
                // eslint-disable-next-line react/jsx-props-no-spreading
                <a ref={forwardedReference} href={href} target="_blank" rel="noreferrer" {...properties}>
                    {children}
                    <span className="sr-only"> (opens in a new tab)</span>
                </a>
            );
        }

        if (!href) {
            return (
                // eslint-disable-next-line react/jsx-props-no-spreading
                <a ref={forwardedReference} {...properties}>
                    {children}
                </a>
            );
        }

        if (nextVersion > 12 || config.newNextLinkBehavior) {
            return (
                // eslint-disable-next-line react/jsx-props-no-spreading
                <NextLink ref={forwardedReference} href={href} {...properties}>
                    {children}
                </NextLink>
            );
        }

        return (
            <NextLink href={href} passHref>
                {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                <a ref={forwardedReference} {...properties}>
                    {children}
                </a>
            </NextLink>
        );
    },
);

export default Anchor;
