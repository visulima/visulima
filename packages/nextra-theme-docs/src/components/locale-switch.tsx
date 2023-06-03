import { useRouter } from "next/router";
import { GlobeIcon } from "nextra/icons";
import type { FC } from "react";

import { DEFAULT_LOCALE } from "../constants";
import { useConfig } from "../contexts";
import type { DocumentationThemeConfig } from "../theme/theme-schema";
import { renderString } from "../utils";
import Select from "./select";

interface LocaleSwitchProperties {
    options: NonNullable<DocumentationThemeConfig["i18n"]>;
    lite?: boolean;
    className?: string;
}

const LocaleSwitch: FC<LocaleSwitchProperties> = ({ options, lite = false, className }) => {
    const config = useConfig();
    const { locale, asPath } = useRouter();
    const selected = options.find((l) => locale === l.locale);

    return (
        <Select
            title={renderString(config.localSwitch.title, { locale: locale ?? DEFAULT_LOCALE })}
            className={className}
            onChange={(option) => {
                const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

                // eslint-disable-next-line unicorn/no-document-cookie
                document.cookie = `NEXT_LOCALE=${option.key}; expires=${date.toUTCString()}; path=/`;
                // eslint-disable-next-line no-restricted-globals
                location.href = asPath;
            }}
            selected={{
                key: selected?.locale ?? "",
                name: (
                    <div className="flex items-center gap-2">
                        <GlobeIcon />
                        <span className={lite ? "hidden" : ""}>{selected?.name}</span>
                    </div>
                ),
            }}
            options={options.map((l) => {
                return {
                    key: l.locale,
                    name: l.name,
                };
            })}
        />
    );
};

export default LocaleSwitch;
