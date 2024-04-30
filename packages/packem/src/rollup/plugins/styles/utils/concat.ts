import { SourceMapGenerator } from "source-map-js";

import type { Extracted } from "../loaders/types";
import { mm } from "./sourcemap";

interface Concatenated {
    css: string;
    map: SourceMapGenerator;
}

export default async function (extracted: Extracted[]): Promise<Concatenated> {
    const sm = new SourceMapGenerator({ file: "" });
    const content = [];

    let offset = 0;

    for await (const { css, map } of extracted) {
        content.push(css);
        const _map = mm(map);

        const data = _map.toObject();
        if (!data) {
            continue;
        }

        const consumer = _map.toConsumer();

        if (!consumer) {
            continue;
        }

        consumer.eachMapping((m) =>
            sm.addMapping({
                generated: { column: m.generatedColumn, line: offset + m.generatedLine },
                name: m.name,
                original: { column: m.originalColumn, line: m.originalLine },
                source: m.source,
            }),
        );

        if (data.sourcesContent) {
            for (const source of data.sources) {
                const content = consumer.sourceContentFor(source, true);

                sm.setSourceContent(source, content);
            }
        }

        offset += css.split("\n").length;
    }

    return {
        css: content.join("\n"),
        map: sm,
    };
}
