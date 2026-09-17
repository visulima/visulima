/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import type { JsonViewRegistry } from "../../json-view";
import { baseActions, baseRegistry, JsonView } from "../../json-view";
import type { AppComponentProps } from "../../types/app";
import { readJsonLdSchemas, readMetaTags } from "./analyze";
import GroupHeading from "./components/group-heading";
import RawToggleRow from "./components/raw-toggle-row";
import SummaryRow from "./components/summary-row";
import buildSeoSpec from "./spec";
import type { SeoSnapshot } from "./types";

const registry: JsonViewRegistry = { ...baseRegistry, GroupHeading, RawToggleRow, SummaryRow };

const LoadingState = (): JSX.Element => (
    <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
        <div aria-hidden="true" class="flex gap-1.5 items-center">
            {([0, 160, 320] as const).map((delay) => (
                <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
            ))}
        </div>
        <span class="text-[0.75rem] text-muted-foreground">Reading meta tags…</span>
    </div>
);

const SeoApp = (_props: AppComponentProps): JSX.Element => {
    const [snapshot, setSnapshot] = useState<SeoSnapshot | undefined>(undefined);

    const refresh = (): void => {
        setSnapshot({ meta: readMetaTags(), schemas: readJsonLdSchemas() });
    };

    useEffect(() => {
        refresh();
    }, []);

    const spec = useMemo(() => (snapshot ? buildSeoSpec(snapshot) : undefined), [snapshot]);

    if (!spec) {
        return <LoadingState />;
    }

    return <JsonView actions={{ ...baseActions, refresh }} registry={registry} spec={spec} />;
};

export default SeoApp;
