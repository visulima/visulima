import type { FC } from "react";
import { oasToSnippet, supportedLanguages } from "@readme/oas-to-snippet";
import { useState } from "react";
import { useRouter } from "next/router";
import { Tab, Tabs } from "../../tabs";
import { useConfig } from "../../../config";
import Button from "../../button";
import Pre from "../../pre";
import Code from "../../code";
import { renderString } from "../../../utils/render";
import { DEFAULT_LOCALE } from "../../../constants/base";

const Snippet: FC<{
    body: string;
    headers: string;
    method: string;
    url: string;
}> = ({ body, headers, method, url, ...properties }) => {
    const config = useConfig();
    const { locale } = useRouter();
    const [language, setLanguage] = useState("curl");

    const languages = { ...supportedLanguages };
    const { title, visibleLanguages } = config.api.snippet;

    visibleLanguages.forEach((lang) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete languages[lang as keyof typeof languages];
    });

    return (
        <section>
            <header>
                <h3 className="font-bold">{renderString(title, { locale: locale ?? DEFAULT_LOCALE })}</h3>
            </header>
            <div className="inline-flex gap-5">
                {visibleLanguages.map((lang) => (
                    <Button title={lang}>{lang}</Button>
                ))}
            </div>
            <Pre hasCopyCode>
                <Code>test</Code>
            </Pre>
        </section>
    );
};

export default Snippet;
