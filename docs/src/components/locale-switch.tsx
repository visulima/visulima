import { useRouter } from "next/router";
import { GlobeIcon } from "nextra/icons";
import React, { ReactElement } from "react";

import { DocsThemeConfig } from "../types";
import Select from "./select";

interface LocaleSwitchProperties {
    options: NonNullable<DocsThemeConfig["i18n"]>;
    lite?: boolean;
    className?: string;
}

const LocaleSwitch = ({ options, lite, className }: LocaleSwitchProperties): ReactElement => {
    const { locale, asPath } = useRouter();
    const selected = options.find((l) => locale === l.locale);
    return (
        <Select
            title="Change language"
            className={className}
            onChange={(option) => {
                const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
                document.cookie = `NEXT_LOCALE=${option.key}; expires=${date.toUTCString()}; path=/`;
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
