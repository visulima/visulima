import { useRouter } from "next/router";
import { GlobeIcon } from "nextra/icons";
import type { FC } from "react";
import React from "react";

import { DocumentationThemeConfig } from "../types";
import Select from "./select";

interface LocaleSwitchProperties {
    options: NonNullable<DocumentationThemeConfig["i18n"]>;
    lite?: boolean;
    className?: string;
}

const LocaleSwitch: FC<LocaleSwitchProperties> = ({ options, lite, className }) => {
    const { locale, asPath } = useRouter();
    const selected = options.find((l) => locale === l.locale);

    return (
        <Select
            title="Change language"
            className={className}
            onChange={(option) => {
                const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

                // eslint-disable-next-line unicorn/no-document-cookie
                document.cookie = `NEXT_LOCALE=${option.key}; expires=${date.toUTCString()}; path=/`;
                // eslint-disable-next-line no-restricted-globals
                location.href = asPath;
            }}
            selected={{
                key: selected?.locale || "",
                name: (
                    <div className="flex items-center gap-2">
                        <GlobeIcon />
                        <span className={lite ? "hidden" : ""}>{selected?.text}</span>
                    </div>
                ),
            }}
            options={options.map((l) => {
                return {
                    key: l.locale,
                    name: l.text,
                };
            })}
        />
    );
};

export default LocaleSwitch;
