/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import type { JsonViewRegistry } from "../../json-view";
import { baseActions, baseRegistry, JsonView } from "../../json-view";
import type { AppComponentProps } from "../../types/app";
import { LoadingState } from "../../ui";
import { readJsonLdSchemas, readMetaTags } from "./analyze";
import GroupHeading from "./components/group-heading";
import RawToggleRow from "./components/raw-toggle-row";
import SummaryRow from "./components/summary-row";
import buildSeoSpec from "./spec";
import type { SeoSnapshot } from "./types";

const registry: JsonViewRegistry = { ...baseRegistry, GroupHeading, RawToggleRow, SummaryRow };

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
        return <LoadingState label="Reading meta tags…" />;
    }

    return <JsonView actions={{ ...baseActions, refresh }} registry={registry} spec={spec} />;
};

export default SeoApp;
