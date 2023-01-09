import type { NextSeoProps } from "next-seo";
import type { FC, ReactNode } from "react";
import { isValidElement } from "react";
import { z } from "zod";

import type { NavBarProperties } from "../components/navbar";
import type { TOCProperties as TOCPageContentProperties } from "../components/toc/toc-page-content";
import type { TOCProperties as TOCSidebarProperties } from "../components/toc/toc-sidebar";
import type { ActiveType } from "../types";
import type { Item } from "../utils";

function isString(value: unknown): boolean {
    return typeof value === "string";
}

function isFunction(value: unknown): boolean {
    return typeof value === "function";
}

function isReactNode(value: unknown): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return isString(value) || isValidElement(value as any) || isFunction(value);
}

const i18nSchema = z.array(
    z.object({
        direction: z.enum(["ltr", "rtl"]).optional(),
        locale: z.string(),
        name: z.string(),
    }),
);

const reactNode = [isReactNode, { message: "Must be React.ReactNode or React.FC" }] as const;
const fc = [isFunction, { message: "Must be React.FC" }] as const;

export const themeSchema = z
    .object({
        banner: z.object({
            dismissible: z.boolean(),
            key: z.string(),
            content: z.custom<FC | ReactNode>(...reactNode).optional(),
        }),
        chat: z
            .object({
                icon: z.custom<FC | ReactNode>(...reactNode),
                link: z.string().startsWith("https://").optional(),
            })
            .optional(),
        comments: z
            .object({
                repository: z.string(),
                repositoryId: z.string(),
                categoryId: z.string(),
            })
            .or(z.undefined()),
        components: z.record(z.custom<FC>(...fc)).optional(),
        darkMode: z.boolean(),
        direction: z.enum(["ltr", "rtl"]),
        docsRepositoryBase: z.string().startsWith("https://"),
        editLink: z.object({
            component: z
                .custom<
            FC<{
                children: ReactNode;
                className?: string;
                filePath?: string;
            }>
            >(...fc)
                .optional(),
            content: z.custom<FC<{ locale: string }> | ReactNode>(...reactNode),
        }),
        faviconGlyph: z.string().optional(),
        feedback: z.object({
            content: z.custom<FC | ReactNode>(...reactNode).optional(),
            labels: z.string(),
            link: z.function().args(z.object({
                title: z.string(), route: z.string(), docsRepositoryBase: z.string(), labels: z.string(),
            })).returns(z.string()).optional(),
        }),
        backToTop: z.object({
            active: z.boolean(),
            content: z.custom<FC<{ locale: string }> | ReactNode>(...reactNode).or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
        }),
        footer: z.object({
            component: z.custom<FC<{ menu: boolean }> | ReactNode>(...reactNode),
            copyright: z.custom<FC<{ activeType: ActiveType }> | ReactNode>(...reactNode).optional(),
        }),
        gitTimestamp: z.custom<FC<{ timestamp: Date; locale: string }> | ReactNode>(...reactNode),
        head: z.custom<FC | ReactNode>(...reactNode),
        hero: z
            .object({
                component: z.custom<FC | ReactNode>(...reactNode),
                height: z.string().or(z.number()),
            })
            .optional(),
        i18n: i18nSchema,
        logo: z.custom<FC | ReactNode>(...reactNode),
        logoLink: z.boolean().or(z.string()),
        main: z.custom<FC<{ children: ReactNode }>>(...fc).optional(),
        navbar: z.object({
            linkBack: z.custom<FC<{ locale: string }> | ReactNode>(...reactNode).optional(),
            component: z.custom<FC<NavBarProperties> | ReactNode>(...reactNode),
            extraContent: z.custom<FC | ReactNode>(...reactNode).optional(),
        }),
        navigation: z.boolean().or(
            z.object({
                next: z.boolean(),
                prev: z.boolean(),
            }),
        ),
        newNextLinkBehavior: z.boolean(),
        nextThemes: z.object({
            defaultTheme: z.string(),
            forcedTheme: z.string().optional(),
            storageKey: z.string(),
        }),
        notFound: z.object({
            content: z.custom<FC | ReactNode>(...reactNode),
            labels: z.string(),
            pages: z
                .function()
                .args(z.object({ locale: z.string() }))
                .returns(
                    z.array(
                        z.object({
                            url: z.string(),
                            title: z.string(),
                            subtitle: z.string().or(z.undefined()),
                            icon: z.custom<FC | ReactNode>(...reactNode).or(z.undefined()),
                        }),
                    ),
                )
                .optional(),
        }),
        primaryHue: z.number().or(
            z.object({
                dark: z.number(),
                light: z.number(),
            }),
        ),
        project: z.object({
            icon: z.custom<FC | ReactNode>(...reactNode),
            link: z.string().startsWith("https://").optional(),
        }),
        search: z.object({
            codeblocks: z.boolean(),
            component: z.custom<FC<{ className?: string; directories: Item[] }> | ReactNode>(...reactNode),
            emptyResult: z.custom<FC | ReactNode>(...reactNode),
            error: z.string().or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
            loading: z.string().or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
            // Can't be React component
            placeholder: z.string().or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
            position: z.enum(["sidebar", "navbar"]),
        }),
        serverSideError: z.object({
            content: z.custom<FC | ReactNode>(...reactNode),
            labels: z.string(),
        }),
        sidebar: z.object({
            defaultMenuCollapseLevel: z.number().min(2).int(),
            titleComponent: z.custom<FC<{ title: string; type: string; route: string }> | ReactNode>(...reactNode),
        }),
        tocContent: z.object({
            component: z.custom<FC<TOCPageContentProperties>>(...fc),
            float: z.boolean(),
            title: z.custom<FC | ReactNode>(...reactNode),
        }),
        tocSidebar: z.object({
            title: z.string(),
            component: z.custom<FC<TOCSidebarProperties>>(...fc),
            extraContent: z.custom<FC | ReactNode>(...reactNode).optional(),
            float: z.boolean(),
        }),
        useNextSeoProps: z.custom<() => NextSeoProps | void>(isFunction),
        themeSwitch: z.object({
            title: z.string().or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
            light: z.string().or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
            dark: z.string().or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
            system: z.string().or(
                z
                    .function()
                    .args(z.object({ locale: z.string() }))
                    .returns(z.string()),
            ),
        }),
    })
    .strict();

export const publicThemeSchema = themeSchema.deepPartial().extend({
    // to have `locale` and `text` as required properties
    i18n: i18nSchema,
});

export type DocumentationThemeConfig = z.infer<typeof themeSchema>;
export type PartialDocumentsThemeConfig = z.infer<typeof publicThemeSchema>;
