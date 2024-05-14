import path from "node:path";

import { packageFilterBuilder, resolveAsync, resolveSync } from "../../utils/resolve";
import { getUrlOfPartial, isModule, normalizeUrl } from "../../utils/url";

const extensions = [".scss", ".sass", ".css"];
const conditions = ["sass", "style"];

export const importer: sass.Importer = (url, importer, done): void => {
    const finalize = (id: string): void => done({ file: id.replace(/\.css$/i, "") });
    const next = (): void => done(null);

    if (!isModule(url)) {
        {
            next();
            return;
        }
    }

    const moduleUrl = normalizeUrl(url);
    const partialUrl = getUrlOfPartial(moduleUrl);
    const options = {
        basedirs: [path.dirname(importer)],
        caller: "Sass importer",
        extensions,
        packageFilter: packageFilterBuilder({ conditions }),
    };

    // Give precedence to importing a partial
    resolveAsync([partialUrl, moduleUrl], options).then(finalize).catch(next);
};

const finalize = (id: string): sass.Data => {
    return { file: id.replace(/\.css$/i, "") };
};
export const importerSync: sass.Importer = (url, importer): sass.Data => {
    if (!isModule(url)) {
        return null;
    }

    const moduleUrl = normalizeUrl(url);
    const partialUrl = getUrlOfPartial(moduleUrl);
    const options = {
        basedirs: [path.dirname(importer)],
        caller: "Sass importer",
        extensions,
        packageFilter: packageFilterBuilder({ conditions }),
    };
    // Give precedence to importing a partial
    try {
        return finalize(resolveSync([partialUrl, moduleUrl], options));
    } catch {
        return null;
    }
};
