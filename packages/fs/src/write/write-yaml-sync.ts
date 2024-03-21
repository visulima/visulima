import type { CreateNodeOptions, DocumentOptions, ParseOptions, SchemaOptions, ToStringOptions } from "yaml";
import { stringify } from "yaml";

import type { YamlReplacer } from "../types";
import writeFileSync from "./write-file-sync";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type Options = CreateNodeOptions & DocumentOptions & ParseOptions & SchemaOptions & ToStringOptions;

function writeYamlSync(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    options?: Options,
): void;
function writeYamlSync(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    replacer?: YamlReplacer,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    options?: Options | number | string,
): void;
// eslint-disable-next-line func-style
function writeYamlSync(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
    data: any,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    replacer?: Options | YamlReplacer,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    options?: number | string | (CreateNodeOptions & DocumentOptions & ParseOptions & SchemaOptions & ToStringOptions),
): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment
    const content = typeof replacer === "function" || Array.isArray(replacer) ? stringify(data, replacer, options) : stringify(data, replacer as YamlReplacer);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeFileSync(path, content);
}

export default writeYamlSync;
