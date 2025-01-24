// eslint-disable-next-line unicorn/prevent-abbreviations
import type { BaseDocsData, BaseMetaData, Source,VirtualFile } from "../types";

export function createMDXSource<Docs extends BaseDocsData, Meta extends BaseMetaData>(
    allDocs: Docs[],
    allMetas: Meta[],
): Source<{
    metaData: Meta;
    pageData: Docs;
}> {
    return {
        files: [
            ...allDocs.map<VirtualFile>((v) => {return {
                data: v,
                path: v._meta.filePath,
                type: "page",
            }}),
            ...allMetas.map<VirtualFile>((v) => {return {
                data: v,
                path: v._meta.filePath,
                type: "meta",
            }}),
        ],
    };
}
