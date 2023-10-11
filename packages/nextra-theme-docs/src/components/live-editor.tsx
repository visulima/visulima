import { clsx } from "clsx";
import { decode } from "he";
import { themes } from "prism-react-renderer";
import type { ComponentProps, ReactElement } from "react";
import React, { useMemo, useState } from "react";
import { renderToString } from "react-dom/server";
import { LiveEditor as ReactLiveEditor, LiveError, LivePreview, LiveProvider } from "react-live";

import CopyToClipboard from "./copy-to-clipboard";

const importToRequire = (code: string) =>
    code
        // { a as b } => { a: b }
        // eslint-disable-next-line require-unicode-regexp
        .replaceAll(/([\w$]+) as ([\w$]+)/gi, "$1: $2")
        // import { a } from "a" => const { a } = require("b")
        // eslint-disable-next-line unicorn/better-regex,require-unicode-regexp
        .replaceAll(/import \{([^}]+)\} from ([^\s;]+);?/g, "const {$1} = require($2);")
        // import a from "a" => const a = require("a").default || require("a")
        // eslint-disable-next-line require-unicode-regexp
        .replaceAll(/import (\S+) from ([^\s;]+);?/g, "const $1 = require($2).default || require($2);")
        // import * as a from "a"
        // eslint-disable-next-line require-unicode-regexp
        .replaceAll(/import \* as (\S+) from ([^\s;]+);?/g, "const $1 = require($2);")
        // import a from "a" => const a = require("a").default || require("a")
        // eslint-disable-next-line unicorn/better-regex,require-unicode-regexp
        .replaceAll(/import (.+),\s?\{([^}]+)\} from ([^\s;]+);?/g, ["const $1 = require($3).default || require($3);", "const {$2} = require($3);"].join("\n"));

const LiveEditor = ({
    children = undefined,
    code = "",
    filename = undefined,
    hasCopyCode = true,
    language = "text",
    modules = {},
    noInline = false,
    theme = themes.palenight,
}: ComponentProps<"pre"> & {
    children?: ReactElement;
    code?: string;
    filename?: string;
    hasCopyCode?: boolean;
    language?: string;
    modules?: Record<string, unknown>;
    noInline?: boolean;
    theme?: (typeof themes)[keyof typeof themes];
}): ReactElement => {
    const themeWithBackground = useMemo(() => {
        return { ...theme, plain: { ...theme.plain, backgroundColor: "transparent" } };
    }, [theme]);

    const compiledCode = decode(children === undefined ? code : renderToString(children)) as string;
    const [copyCode, setCopyCode] = useState<string>(compiledCode);

    // eslint-disable-next-line unicorn/prevent-abbreviations
    const req = (path: string): string => {
        // eslint-disable-next-line security/detect-object-injection
        const dep: string | undefined = modules[path] as string | undefined;

        if (!dep) {
            throw new Error(`Unable to resolve path to module '${path}'. Use "LiveConfig" to provide modules.`);
        }

        return dep;
    };

    return (
        <LiveProvider
            code={compiledCode}
            enableTypeScript
            language={language}
            noInline={noInline}
            /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
            scope={{ react: React, require: req }} // <-- inject objects you need access to
            theme={themeWithBackground}
            /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
            transformCode={(tCode: string) => `${importToRequire(tCode)}`}
        >
            <LivePreview />
            <LiveError />

            <div
                className={clsx(
                    "nextra-code-block",
                    "mb-8 mt-5 py-2 first:mt-0 last:mb-0",
                    "bg-gray-800 dark:bg-gray-800/40",
                    "shadow-lg dark:shadow-none",
                    "dark:ring-1 dark:ring-gray-300/10",
                    "relative overflow-hidden rounded-lg",
                )}
            >
                {filename ? (
                    <div className="flex text-xs leading-6 text-slate-400">
                        <div className="flex flex-none items-center border-y border-b-blue-300 border-t-transparent px-4 py-1 text-blue-300">{filename}</div>
                        <div className="flex h-8 flex-auto items-center justify-items-end rounded-tl border border-slate-500/30 bg-slate-700/50 pr-4">
                            <div className="grow" />
                            {hasCopyCode && (
                                /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                                <CopyToClipboard as="button" getValue={() => copyCode} tabIndex={-1} />
                            )}
                        </div>
                    </div>
                ) : (
                    <div
                        className={clsx([
                            "opacity-0 transition-opacity focus-within:opacity-100 [div:hover>&]:opacity-100",
                            "absolute right-0 z-10 m-2 flex gap-1",
                        ])}
                    >
                        {/* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */}
                        {hasCopyCode && <CopyToClipboard getValue={() => copyCode} tabIndex={-1} />}
                    </div>
                )}
                {/* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */}
                <ReactLiveEditor className="p-0" code={compiledCode} language={language} onChange={(newCode) => setCopyCode(newCode)} />
            </div>
        </LiveProvider>
    );
};

export default LiveEditor;
