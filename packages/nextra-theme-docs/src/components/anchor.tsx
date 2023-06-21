import NextLink from "next/link";
import next from "next/package.json";
import type { ComponentProps, ReactElement } from "react";
import { forwardRef } from "react";

type AnchorProperties = Omit<ComponentProps<"a">, "ref"> & {
    newWindow?: boolean;
};

const nextVersion = Number(next.version.split(".")[0]);

const Anchor = forwardRef<HTMLAnchorElement, AnchorProperties>(
    (
        { href = "", children, newWindow, ...properties },
        // ref is used in <NavbarMenu />
        forwardedReference,
    ): ReactElement => {
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

        if (nextVersion > 12) {
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
