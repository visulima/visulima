import type { Components as MdxComponents, MergeComponents } from "@mdx-js/react/lib";
import type { NextSeoProps } from "next-seo";
import type { Item } from "nextra/normalize-pages";
import type { FC, ReactNode } from "react";
import { isValidElement } from "react";
import type { DefaultToastOptions } from "react-hot-toast";
import type { ZodType } from "zod";
import { z } from "zod";

import type { NavBarProperties } from "../components/navbar";
import type { TOCProperties as TOCPageContentProperties } from "../components/toc/toc-page-content";
import type { TOCProperties as TOCSidebarProperties } from "../components/toc/toc-sidebar";
import type { ActiveType } from "../types";

const isFunction = (value: unknown): boolean => typeof value === "function";

const isReactNode = (value: unknown): boolean => typeof value === "string" || isValidElement(value as unknown) || isFunction(value);

const i18nSchema = z.array(
    z
        .object({
            direction: z.enum(["ltr", "rtl"]).optional(),
            locale: z.string(),
            name: z.string(),
        })
        .strict(),
);

const reactNode = [isReactNode, { message: "Must be React.ReactNode or React.FC" }] as const;
const fc = [isFunction, { message: "Must be React.FC" }] as const;

const stringOrFunction = z.string().or(
    z
        .function()
        .args(z.object({ locale: z.string() }).strict())
        .returns(z.string()),
);

// eslint-disable-next-line import/exports-last
export const themeSchema = z
    .object({
        backToTop: z
            .object({
                active: z.boolean(),
                content: z.custom<FC<{ locale: string }> | ReactNode>(...reactNode).or(
                    z
                        .function()
                        .args(z.object({ locale: z.string() }).strict())
                        .returns(z.string()),
                ),
            })
            .strict(),
        banner: z
            .object({
                content: z.custom<FC | ReactNode>(...reactNode).optional(),
                dismissible: z.boolean(),
                key: z.string(),
            })
            .strict(),
        // eslint-disable-next-line zod/require-strict
        chat: z
            .object({
                icon: z.custom<FC | ReactNode>(...reactNode),
                link: z.string().startsWith("https://").optional(),
            })
            .optional(),
        // eslint-disable-next-line zod/require-strict
        comments: z
            .object({
                categoryId: z.string(),
                repository: z.string(),
                repositoryId: z.string(),
            })
            .optional(),
        components: z.custom<MdxComponents | MergeComponents | null | undefined>(...fc).optional(),

        content: z
            .object({
                permalink: z.object({ label: stringOrFunction }).strict(),
                showDescription: z.boolean().optional(),
                showTitle: z.boolean().optional(),
            })
            .strict(),
        darkMode: z.boolean(),
        direction: z.enum(["ltr", "rtl"]),
        docsRepositoryBase: z.string().startsWith("https://"),
        editLink: z
            .object({
                component: z
                    .custom<
                        FC<{
                            children: ReactNode;
                            className?: string;
                            filePath?: string;
                        }>
                    >(...fc)
                    .optional(),
                content: z.string().or(
                    z
                        .function()
                        .args(z.object({ locale: z.string() }).strict())
                        .returns(z.string())
                        .or(z.custom<FC<{ locale: string }> | ReactNode>(...reactNode)),
                ),
            })
            .strict(),
        faviconGlyph: z.string().optional(),
        feedback: z
            .object({
                content: z.custom<FC | ReactNode>(...reactNode).optional(),
                labels: z.string(),
                link: z
                    .function()
                    .args(
                        z
                            .object({
                                docsRepositoryBase: z.string(),
                                labels: z.string(),
                                route: z.string(),
                                title: z.string(),
                            })
                            .strict(),
                    )
                    .returns(z.string())
                    .optional(),
            })
            .strict(),
        footer: z
            .object({
                className: z.string().optional(),
                component: z.custom<FC<{ menu: boolean }> | ReactNode>(...reactNode),
                copyright: z.custom<FC<{ activeType: ActiveType }> | ReactNode>(...reactNode).optional(),
            })
            .strict(),
        gitTimestamp: z.custom<FC<{ locale: string; timestamp: Date }> | ReactNode>(...reactNode),
        head: z.custom<FC | ReactNode>(...reactNode),
        // eslint-disable-next-line zod/require-strict
        hero: z
            .object({
                component: z.custom<FC | ReactNode>(...reactNode),
                height: z.string().or(z.number()),
            })
            .optional(),
        i18n: i18nSchema.default([]),
        localSwitch: z
            .object({
                title: stringOrFunction,
            })
            .strict(),
        logo: z.custom<FC | ReactNode>(...reactNode),
        logoLink: z.boolean().or(z.string()),
        main: z.custom<FC<{ children: ReactNode }>>(...fc).optional(),
        navbar: z
            .object({
                component: z.custom<FC<NavBarProperties> | ReactNode>(...reactNode),
                extraContent: z.custom<FC | ReactNode>(...reactNode).optional(),
                linkBack: z.custom<FC<{ locale: string }> | ReactNode>(...reactNode).optional(),
            })
            .strict(),
        navigation: z.boolean().or(
            z
                .object({
                    next: z.boolean(),
                    prev: z.boolean(),
                })
                .strict(),
        ),
        nextThemes: z
            .object({
                attribute: z.string().optional(),
                defaultTheme: z.string(),
                forcedTheme: z.string().optional(),
                storageKey: z.string(),
            })
            .strict(),
        notFound: z
            .object({
                content: z.custom<FC | ReactNode>(...reactNode),
                labels: z.string(),
                pages: z
                    .function()
                    .args(z.object({ locale: z.string() }).strict())
                    .returns(
                        z.array(
                            z
                                .object({
                                    icon: z.custom<FC | ReactNode>(...reactNode).or(z.undefined()),
                                    subtitle: z.string().or(z.undefined()),
                                    title: z.string(),
                                    url: z.string(),
                                })
                                .strict(),
                        ),
                    )
                    .optional(),
            })
            .strict(),
        primaryHue: z.number().or(
            z
                .object({
                    dark: z.number(),
                    light: z.number(),
                })
                .strict(),
        ),
        project: z
            .object({
                icon: z.custom<FC | ReactNode>(...reactNode),
                link: z.string().startsWith("https://").optional(),
            })
            .strict(),
        // eslint-disable-next-line zod/require-strict
        sandbox: z
            .object({
                providers: z.object({}).catchall(z.string()).strict(),
            })
            .optional(),
        search: z
            .object({
                codeblocks: z.boolean(),
                component: z.custom<FC<{ className?: string; directories: Item[] }> | ReactNode>(...reactNode),
                emptyResult: z.custom<FC | ReactNode>(...reactNode),
                error: stringOrFunction,
                loading: stringOrFunction,
                // Can't be React component
                placeholder: stringOrFunction,
                position: z.enum(["sidebar", "navbar"]),
            })
            .strict(),
        serverSideError: z
            .object({
                content: z.custom<FC | ReactNode>(...reactNode),
                labels: z.string(),
            })
            .strict(),
        sidebar: z
            .object({
                autoCollapse: z.boolean().optional(),
                defaultMenuCollapseLevel: z.number().min(1).int(),
                icon: z.custom<FC<{ className: string; route: string; title: string; type: string }> | ReactNode>(...reactNode).optional(),
                mobileBreakpoint: z.number().min(0).int(),
                titleComponent: z.custom<FC<{ route: string; title: string; type: string }> | ReactNode>(...reactNode),
            })
            .strict(),
        themeSwitch: z
            .object({
                dark: stringOrFunction,
                light: stringOrFunction,
                system: stringOrFunction,
                title: stringOrFunction,
            })
            .strict(),
        // eslint-disable-next-line zod/require-strict
        toaster: z
            .object({
                gutter: z.number().optional(),

                position: z.enum(["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"]).optional(),
                // TODO: Find a good way to type this
                reverseOrder: z.boolean().optional(),
                // eslint-disable-next-line zod/require-strict
                toastOptions: z.object({}).catchall<ZodType<DefaultToastOptions>>(z.any()).optional(),
            })
            .optional(),
        tocContent: z
            .object({
                component: z.custom<FC<TOCPageContentProperties>>(...fc),
                float: z.boolean(),
                headingComponent: z.custom<FC<{ children: string; id: string }>>(...fc).optional(),
                title: z.custom<FC | ReactNode>(...reactNode),
            })
            .strict(),
        tocSidebar: z
            .object({
                component: z.custom<FC<TOCSidebarProperties>>(...fc),
                extraContent: z.custom<FC | ReactNode>(...reactNode).optional(),
                float: z.boolean(),
                headingComponent: z.custom<FC<{ children: string; id: string }>>(...fc).optional(),
                title: z.string(),
            })
            .strict(),
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
        useNextSeoProps: z.custom<() => NextSeoProps | void>(isFunction),
    })
    .strict();

// @see https://github.com/colinhacks/zod/discussions/2527

const publicThemeSchema = themeSchema.deepPartial().extend({
    // to have `locale` and `text` as required properties
    i18n: i18nSchema.optional(),
});

export type DocumentationThemeConfig = z.infer<typeof themeSchema>;
export type PartialDocumentsThemeConfig = z.infer<typeof publicThemeSchema>;
