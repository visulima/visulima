import { ThemeProvider } from "next-themes";
import type { FrontMatter, PageMapItem, PageOpts } from "nextra";
import { metaSchema } from "nextra/normalize-pages";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { ZodError } from "zod";
import { z } from "zod";

import { DEEP_OBJECT_KEYS, DEFAULT_THEME } from "../constants";
import type { DocumentationThemeConfig } from "../theme/theme-schema";
import { themeSchema } from "../theme/theme-schema";
import type { Context } from "../types";
import { MenuProvider } from "./menu";

const ConfigContext = createContext<Config>({
    title: "",
    description: "",
    frontMatter: {},
    ...DEFAULT_THEME,
});

let theme: DocumentationThemeConfig;
let isValidated = false;

const extendedMetaSchema = metaSchema.or(
    z
        .object({
            description: z.string().optional(),
            icon: z.string().optional(),
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

export const useConfig = function<FrontMatterType = FrontMatter>(): Config<FrontMatterType> {
    // @ts-expect-error TODO: fix Type 'Config<{ [key: string]: any; }>' is not assignable to type 'Config<FrontMatterType>'.
    return useContext<Config<FrontMatterType>>(ConfigContext);
};

export const ConfigProvider = ({ children, value: { themeConfig, pageOpts } }: { children: ReactNode; value: Context }): ReactElement => {
    const [menu, setMenu] = useState(false);

    // Merge only on first load

    theme ||= {
        ...DEFAULT_THEME,
        ...Object.fromEntries(
            Object.entries(themeConfig).map(([key, value]) => [
                key,
                value && typeof value === "object" && DEEP_OBJECT_KEYS.includes(key)
                    ? // @ts-expect-error -- key has always object value
                      { ...DEFAULT_THEME[key], ...value }
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
            flexsearch: pageOpts.flexsearch,
            title: pageOpts.title,
            description: pageOpts.description,
            frontMatter: pageOpts.frontMatter,
        };
    }, [pageOpts]);

    const { nextThemes, darkMode } = extendedConfig;
    const forcedTheme = darkMode ? nextThemes.forcedTheme : "light";

    return (
        <ThemeProvider
            attribute={nextThemes.attribute ?? "class"}
            disableTransitionOnChange
            defaultTheme={nextThemes.defaultTheme}
            storageKey={nextThemes.storageKey}
            forcedTheme={forcedTheme}
        >
            <ConfigContext.Provider value={extendedConfig}>
                <MenuProvider value={{ menu, setMenu }}>{children}</MenuProvider>
            </ConfigContext.Provider>
        </ThemeProvider>
    );
};

export type Config<FrontMatterType = FrontMatter> = DocumentationThemeConfig &
    Pick<PageOpts<FrontMatterType>, "flexsearch" | "frontMatter" | "title"> & { description?: string };
