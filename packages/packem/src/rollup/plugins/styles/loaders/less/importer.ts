import fs from "fs-extra";

import { resolveAsync } from "../../utils/resolve";
import { getUrlOfPartial, normalizeUrl } from "../../utils/url";

const extensions = [".less", ".css"];

const getStylesFileManager = (less: LessStatic): Less.FileManager =>
    new (class extends less.FileManager implements Less.FileManager {
        supports(): boolean {
            return true;
        }

        async loadFile(filename: string, filedir: string, options_: Less.Options): Promise<Less.FileLoadResult> {
            const url = normalizeUrl(filename);
            const partialUrl = getUrlOfPartial(url);
            const options = { basedirs: [filedir], caller: "Less importer", extensions };

            if (options_.paths) {
                options.basedirs.push(...options_.paths);
            }

            // Give precedence to importing a partial
            const id = await resolveAsync([partialUrl, url], options);

            return { contents: await fs.readFile(id, "utf8"), filename: id };
        }
    })();

const importer: Less.Plugin = {
    install(less, pluginManager) {
        pluginManager.addFileManager(getStylesFileManager(less));
    },
};

export default importer;
