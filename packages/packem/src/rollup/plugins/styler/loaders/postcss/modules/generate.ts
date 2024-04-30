import path from "node:path";

import { makeLegalIdentifier } from "@rollup/pluginutils";

import hasher from "../../../utils/hasher";
import { hashRe } from "../common";

export default (placeholder = "[name]_[local]__[hash:8]") =>
    (local: string, file: string, css: string): string => {
        const { base, dir, name } = path.parse(file);
        const hash = hasher(`${base}:${css}`);
        const match = hashRe.exec(placeholder);
        const hashLength = match && Number.parseInt(match[1]);

        return makeLegalIdentifier(
            placeholder
                .replace("[dir]", path.basename(dir))
                .replace("[name]", name)
                .replace("[local]", local)
                .replace(hashRe, hashLength ? hash.slice(0, hashLength) : hash),
        );
    };
