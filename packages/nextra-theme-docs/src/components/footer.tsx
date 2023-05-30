import cn from "clsx";
import type { PageTheme } from "nextra/normalize-pages";
import type { ReactElement } from "react";

import { useConfig } from "../contexts";
import { renderComponent } from "../utils";
import LocaleSwitch from "./locale-switch";
import ThemeSwitch from "./theme-switch";

const Footer = ({ activeType, themeContext, locale }: { activeType: string; themeContext: PageTheme; locale: string }): ReactElement => {
    const config = useConfig();
    const isLayoutRaw = themeContext.layout === "raw";

    return (
        <footer
            className={cn(
                "pb-[env(safe-area-inset-bottom)] footer-border dark:footer-border",
                // eslint-disable-next-line max-len
                ["page", "hidden"].includes(activeType) || isLayoutRaw
                    ? "px-2 md:px-6 lg:px-8"
                    : "lg:bg-x-gradient-gray-200-gray-200-50-white-50 lg:dark:bg-x-gradient-dark-700-dark-700-50-dark-800",
            )}
        >
            <div className="mx-auto flex flex-col bg-white dark:bg-darker-800 lg:max-w-[90rem] lg:flex-row">
                <div
                    className={cn(
                        "flex lg:flex-col py-6 lg:py-12 lg:w-64 lg:shrink-0",
                        // eslint-disable-next-line max-len
                        ["page", "hidden"].includes(activeType) || isLayoutRaw
                            ? ""
                            : "lg:bg-x-gradient-gray-200-gray-400-75 lg:dark:bg-x-gradient-dark-700-dark-800-65",
                    )}
                >
                    {(config.i18n.length > 0 || config.darkMode) && (
                        <div className={cn("mx-auto lg:mx-0 flex", activeType === "doc" && !isLayoutRaw ? "lg:hidden" : "mb-6 lg:mb-12")}>
                            {config.i18n.length > 0 && <LocaleSwitch options={config.i18n} />}
                            <div className="grow" />
                            {config.darkMode && <ThemeSwitch locale={locale} />}
                        </div>
                    )}
                    {/*  eslint-disable-next-line max-len */}
                    <div className="hidden px-6 lg:block">{config.footer.copyright && renderComponent(config.footer.copyright, { activeType })}</div>
                </div>
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
