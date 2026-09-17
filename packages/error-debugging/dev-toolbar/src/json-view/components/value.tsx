/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

import CopyButton from "./copy-button";

const LOOKS_LIKE_PATH = /^\/|^[A-Z]:\\/i;

const PATH_SHORTEN_AT = 40;

/** Boolean indicator — true reads as success, false as muted (config values are not alarming). */
export const BoolValue = ({ value }: { value: boolean }): JSX.Element => (
    <span class="inline-flex items-center gap-1.5">
        <span aria-hidden="true" class={clsx("inline-block size-1.5 rounded-full", value ? "bg-success" : "bg-border")} />
        <span class={clsx("text-xs font-mono font-medium", value ? "text-success" : "text-muted-foreground")}>{value ? "true" : "false"}</span>
    </span>
);

/** Compact pill list for arrays. */
export const TagList = ({ items }: { items: string[] }): JSX.Element => {
    if (items.length === 0) {
        return <span class="text-muted-foreground text-xs italic opacity-50">empty</span>;
    }

    return (
        <div class="flex flex-wrap gap-1">
            {items.map((item) => (
                <span
                    class="inline-flex items-center px-1.5 py-0.5 text-xxs font-mono font-medium bg-secondary border border-border text-secondary-foreground"
                    key={item}
                >
                    {item}
                </span>
            ))}
        </div>
    );
};

/** Shortens a path to `…/last/three/segments`; the full path stays in the title. */
export const ShortPath = ({ path }: { path: string }): JSX.Element => {
    const segments = path.replaceAll("\\", "/").split("/").filter(Boolean);
    const short = segments.length > 3 ? `…/${segments.slice(-3).join("/")}` : path;

    return (
        <code class="text-xs font-mono text-foreground break-all leading-relaxed" title={path}>
            {short}
        </code>
    );
};

/** Renders any JSON value into the appropriate display element. */
export const ValueCell = ({ value }: { value: unknown }): JSX.Element => {
    if (value === undefined || value === null) {
        return <span class="text-muted-foreground text-xs opacity-40">—</span>;
    }

    if (typeof value === "boolean") {
        return <BoolValue value={value} />;
    }

    if (Array.isArray(value)) {
        return <TagList items={value.map(String)} />;
    }

    if (typeof value === "object") {
        const json = JSON.stringify(value, undefined, 2);

        return (
            <div class="flex items-start gap-2">
                <pre class="text-xs font-mono text-foreground bg-secondary border border-border px-2 py-1 overflow-auto max-h-24 flex-1 leading-relaxed">
                    {json}
                </pre>
                <CopyButton text={json} />
            </div>
        );
    }

    const stringValue = String(value);

    if (LOOKS_LIKE_PATH.test(stringValue) && stringValue.length > PATH_SHORTEN_AT) {
        return <ShortPath path={stringValue} />;
    }

    return <code class="text-xs font-mono text-foreground break-all leading-relaxed">{stringValue}</code>;
};
