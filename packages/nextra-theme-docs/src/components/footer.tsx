import cn from "clsx";
import type { PageTheme } from "nextra/normalize-pages";
import type { ReactElement } from "react";

import { useConfig } from "../contexts";
import { renderComponent } from "../utils/render";
import LocaleSwitch from "./locale-switch";
import ThemeSwitch from "./theme-switch";

const Footer = ({ activeType, locale, themeContext }: { activeType: string; locale: string; themeContext: PageTheme }): ReactElement => {
    const config = useConfig();
    const isLayoutRaw = themeContext.layout === "raw";

    const hasI18n = config.i18n.length > 1;

    return (
        <footer
            className={cn(
                "pb-[env(safe-area-inset-bottom)] footer-border dark:footer-border",

                ["hidden", "page"].includes(activeType) || isLayoutRaw
                    ? "px-2 md:px-6 lg:px-8"
                    : "lg:bg-x-gradient-gray-200-gray-200-50-white-50 lg:dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
            )}
        >
            <div className="mx-auto flex flex-col bg-white dark:bg-darker-800 lg:max-w-[90rem] lg:flex-row">
                <div
                    className={cn(
                        "flex lg:flex-col py-6 lg:py-12 lg:w-64 lg:shrink-0",

                        ["hidden", "page"].includes(activeType) || isLayoutRaw
                            ? ""
                            : "lg:bg-x-gradient-gray-200-gray-400-75 lg:dark:bg-x-gradient-dark-700-dark-800-65",
                    )}
                >
                    {(hasI18n || config.darkMode) && (
                        <div
                            className={cn("ml-auto mr-auto flex gap-2 lg:px-6 lg:-ml-2", activeType === "doc" && !isLayoutRaw ? "lg:hidden" : "lg:mb-12", {
                                "items-center": hasI18n && config.darkMode,
                            })}
                        >
                            {hasI18n && <LocaleSwitch options={config.i18n} />}
                            {hasI18n && config.darkMode && <div className="grow" />}
                            {config.darkMode && <ThemeSwitch locale={locale} />}
                        </div>
                    )}
                    <div className="hidden px-6 lg:block">{config.footer.copyright && renderComponent(config.footer.copyright, { activeType })}</div>
                </div>
                <div className="footer-border dark:footer-border mb-6 lg:hidden" />
                <div
                    className={cn(
                        "lg:grow lg:py-12 text-gray-600 dark:text-gray-400",
                        "lg:pl-[max(env(safe-area-inset-left),3.2rem)] lg:pr-[max(env(safe-area-inset-right),3.2rem)]",
                    )}
                >
                    {themeContext.footer && renderComponent(config.footer.component)}
                </div>
                <div className="footer-border dark:footer-border mt-8 block w-full py-8 lg:mb-0 lg:hidden lg:py-0">
                    {config.footer.copyright && renderComponent(config.footer.copyright, { activeType })}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
