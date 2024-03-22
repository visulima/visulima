import type { CreateNodeOptions, DocumentOptions, ParseOptions, SchemaOptions, ToStringOptions } from "yaml";
import { stringify } from "yaml";

import type { YamlReplacer } from "../types";
import writeFile from "./write-file";

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type Options = CreateNodeOptions & DocumentOptions & ParseOptions & SchemaOptions & ToStringOptions;

async function writeYaml(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    options?: Options,
): Promise<void>;
async function writeYaml(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    replacer?: YamlReplacer,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    options?: Options | number | string,
): Promise<void>;
// eslint-disable-next-line func-style
async function writeYaml(
    path: URL | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
    data: any,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    replacer?: Options | YamlReplacer,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    options?: Options | number | string,
): Promise<void> {
     
    const content = typeof replacer === "function" || Array.isArray(replacer) ? stringify(data, replacer, options) : stringify(data, replacer as YamlReplacer);

     
    await writeFile(path, content);
}

export default writeYaml;
