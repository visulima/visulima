import { ThemeProvider } from "next-themes";
import { metaSchema } from "nextra/normalize-pages";
import type { FrontMatter, PageMapItem, PageOpts } from "nextra/types";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { ZodError } from "zod";
import { z } from "zod";

import { DEEP_OBJECT_KEYS, DEFAULT_THEME } from "../constants/default-theme-config";
import type { DocumentationThemeConfig } from "../theme/theme-schema";
import { themeSchema } from "../theme/theme-schema";
import type { Context } from "../types";
import { MenuProvider } from "./menu";

const ConfigContext = createContext<Config>({
    description: "",
    frontMatter: {},
    title: "",
    ...DEFAULT_THEME,
});

let theme: DocumentationThemeConfig;
let isValidated = false;

const extendedMetaSchema = metaSchema.or(
    // eslint-disable-next-line zod/require-strict
    z
        .object({
            description: z.string().optional(),
            icon: z.string().optional(),
            // eslint-disable-next-line zod/require-strict
            theme: z
                .object({
                    prose: z.boolean().optional(),
                })
                .optional(),
        })
        .optional(),
);

const normalizeZodMessage = (error: unknown): string =>
    (error as ZodError).issues
        .flatMap((issue) => {
            const themePath = issue.path.length > 0 && `Path: "${issue.path.join(".")}"`;
            const unionErrors = "unionErrors" in issue ? issue.unionErrors.map((data) => normalizeZodMessage(data)) : [];
            return [[issue.message, themePath].filter(Boolean).join(". "), ...unionErrors];
        })
        .join("\n");

const validateMeta = (pageMap: PageMapItem[]) => {
    pageMap.forEach((pageMapItem) => {
        if (pageMapItem.kind === "Meta") {
            Object.entries(pageMapItem.data).forEach(([key, value]) => {
                try {
                    extendedMetaSchema.parse(value);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error(`[nextra-theme-docs] Error validating _meta.json file for "${key}" property.\n\n${normalizeZodMessage(error)}`);
                }
            });
        } else if (pageMapItem.kind === "Folder") {
            validateMeta(pageMapItem.children);
        }
    });
};

export const useConfig = <FrontMatterType = FrontMatter,>(): Config<FrontMatterType> =>
    // @ts-expect-error TODO: fix Type 'Config<{ [key: string]: any; }>' is not assignable to type 'Config<FrontMatterType>'.
    useContext<Config<FrontMatterType>>(ConfigContext);

export const ConfigProvider = ({ children, value: { pageOpts, themeConfig } }: { children: ReactNode; value: Context }): ReactElement => {
    const [menu, setMenu] = useState(false);

    // Merge only on first load
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    theme ||= {
        ...DEFAULT_THEME,
        ...Object.fromEntries(
            Object.entries(themeConfig).map(([key, value]) => [
                key,
                value && typeof value === "object" && DEEP_OBJECT_KEYS.includes(key)
                    ? // @ts-expect-error -- key has always object value
                      // eslint-disable-next-line security/detect-object-injection
                      { ...DEFAULT_THEME[key], ...(value as object) }
                    : value,
            ]),
        ),
    };

    if (process.env.NODE_ENV !== "production" && !isValidated) {
        try {
            themeSchema.parse(theme);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`[nextra-theme-docs] Error validating theme config file.\n\n${normalizeZodMessage(error)}`);
        }

        validateMeta(pageOpts.pageMap);

        isValidated = true;
    }

    const extendedConfig: Config = useMemo(() => {
        return {
            ...theme,
            description: pageOpts.description,
            flexsearch: pageOpts.flexsearch,
            frontMatter: pageOpts.frontMatter,
            title: pageOpts.title,
        };
    }, [pageOpts]);

    const { darkMode, nextThemes } = extendedConfig;
    const forcedTheme = darkMode ? nextThemes.forcedTheme : "light";

    const menuValue = useMemo(() => {
        return { menu, setMenu };
    }, [menu, setMenu]);

    return (
        <ThemeProvider
            attribute={nextThemes.attribute ?? "class"}
            defaultTheme={nextThemes.defaultTheme}
            disableTransitionOnChange
            forcedTheme={forcedTheme}
            storageKey={nextThemes.storageKey}
        >
            <ConfigContext.Provider value={extendedConfig}>
                <MenuProvider value={menuValue}>{children}</MenuProvider>
            </ConfigContext.Provider>
        </ThemeProvider>
    );
};

export type Config<FrontMatterType = FrontMatter> = DocumentationThemeConfig &
    Pick<PageOpts<FrontMatterType>, "flexsearch" | "frontMatter" | "title"> & { description?: string };
