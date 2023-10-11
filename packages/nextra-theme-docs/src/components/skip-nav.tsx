// eslint-disable-next-line no-secrets/no-secrets
/**
 * The code included in this file is inspired by
 * https://github.com/reach/reach-ui/blob/43f450db7bcb25a743121fe31355f2294065a049/packages/skip-nav/src/reach-skip-nav.tsx
 * which is part of the @reach/skip-nav library.
 *
 * @reach/skip-nav is licensed as follows:
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2022, React Training LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Source: https://github.com/reach/reach-ui/blob/43f450db7bcb25a743121fe31355f2294065a049/LICENSE
 */
import cn from "clsx";
import type { ComponentProps, ReactElement } from "react";
import { forwardRef } from "react";

const DEFAULT_ID = "nextra-skip-nav";
const DEFAULT_LABEL = "Skip to content";

type SkipNavLinkProperties = Omit<ComponentProps<"a">, "children" | "href" | "ref"> & {
    label?: string;
};

type SkipNavContentProperties = Omit<ComponentProps<"div">, "children" | "ref">;

export const SkipNavLink = forwardRef<HTMLAnchorElement, SkipNavLinkProperties>(
    ({ className: providedClassName, id, label = DEFAULT_LABEL, ...properties }, forwardedReference): ReactElement => {
        const className =
            providedClassName ??
            cn(
                "sr-only",

                "focus:not-sr-only focus:fixed focus:z-50 focus:m-3 focus:ml-4 focus:h-[calc(var(--nextra-navbar-height)-1rem)] focus:rounded-lg focus:border focus:px-3 focus:py-2 focus:align-middle focus:text-sm focus:font-bold",
                "focus:text-gray-900 focus:dark:text-gray-100",
                "focus:bg-white focus:dark:bg-neutral-900",
                "focus:border-neutral-400 focus:dark:border-neutral-800",
            );

        return (
            <a
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
                className={className}
                href={`#${id ?? DEFAULT_ID}`}
                ref={forwardedReference}
            >
                {label}
            </a>
        );
    },
);

export const SkipNavContent = forwardRef<HTMLDivElement, SkipNavContentProperties>(
    // eslint-disable-next-line react/jsx-props-no-spreading
    ({ id, ...properties }, forwardedReference): ReactElement => <div {...properties} id={id ?? DEFAULT_ID} ref={forwardedReference} />,
);
