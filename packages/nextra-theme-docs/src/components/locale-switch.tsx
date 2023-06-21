import { useRouter } from "next/router";
import { GlobeIcon } from "nextra/icons";
import type { FC } from "react";

import { DEFAULT_LOCALE } from "../constants/base";
import { useConfig } from "../contexts";
import type { DocumentationThemeConfig } from "../theme/theme-schema";
import { renderString } from "../utils/render";
import Select from "./select";

interface LocaleSwitchProperties {
    className?: string;
    lite?: boolean;
    options: NonNullable<DocumentationThemeConfig["i18n"]>;
}

const LocaleSwitch: FC<LocaleSwitchProperties> = ({ className, lite = false, options }) => {
    const config = useConfig();
    const { asPath, locale } = useRouter();
    const selected = options.find((l) => locale === l.locale);

    return (
        <Select
            onChange={(option) => {
                const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

                // eslint-disable-next-line unicorn/no-document-cookie
                document.cookie = `NEXT_LOCALE=${option.key}; expires=${date.toUTCString()}; path=/`;
                // eslint-disable-next-line no-restricted-globals
                location.href = asPath;
            }}
            options={options.map((l) => {
                return {
                    key: l.locale,
                    name: l.name,
                };
            })}
            selected={{
                key: selected?.locale ?? "",
                name: (
                    <div className="flex items-center gap-2">
                        <GlobeIcon />
                        <span className={lite ? "hidden" : ""}>{selected?.name}</span>
                    </div>
                ),
            }}
            className={className}
            title={renderString(config.localSwitch.title, { locale: locale ?? DEFAULT_LOCALE })}
        />
    );
};

export default LocaleSwitch;
