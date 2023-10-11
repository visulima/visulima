import { useRouter } from "next/router";
import { GlobeIcon } from "nextra/icons";
import type { FC } from "react";
import { useCallback, useMemo } from "react";

import { DEFAULT_LOCALE } from "../constants/base";
import { useConfig } from "../contexts";
import { renderString } from "../utils/render";
import type { MenuOption } from "./select";
import Select from "./select";

interface LocaleSwitchProperties {
    className?: string;
    lite?: boolean;
}

const LocaleSwitch: FC<LocaleSwitchProperties> = ({ className = undefined, lite = false }) => {
    const config = useConfig();
    const { asPath, locale } = useRouter();

    const selected = config.i18n.find((l) => locale === l.locale);

    const onChange = useCallback(
        (option: MenuOption) => {
            const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

            // eslint-disable-next-line unicorn/no-document-cookie
            document.cookie = `NEXT_LOCALE=${option.key}; expires=${date.toUTCString()}; path=/`;
            // eslint-disable-next-line no-restricted-globals
            location.href = asPath;
        },
        [asPath],
    );

    const selectedValue = useMemo(() => {
        return {
            key: selected?.locale ?? "",
            name: (
                <div className="flex items-center gap-2">
                    <GlobeIcon />
                    <span className={lite ? "hidden" : ""}>{selected?.name}</span>
                </div>
            ),
        };
    }, [selected, lite]);

    if (config.i18n.length <= 1) {
        return null;
    }

    return (
        <Select
            className={className}
            onChange={onChange}
            options={config.i18n.map((l) => {
                return {
                    key: l.locale,
                    name: l.name,
                };
            })}
            selected={selectedValue}
            title={renderString(config.localSwitch.title, { locale: locale ?? DEFAULT_LOCALE })}
        />
    );
};

export default LocaleSwitch;
