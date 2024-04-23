import type { Plugin } from "rollup";

const nativeNodeModule = (): Plugin => {
    return {
        load(id) {
            if (id.endsWith(".node")) {
                // whenever we encounter an import of the .node file, we return an empty string. This makes it look like the .node file is empty to the bundler. This is because we're going to copy the .node file to the output directory ourselves, so we don't want the bundler to include it in the output bundle (also because the bundler can't handle .node files, it tries to read them as js and then complains that it's invalid js)
                return "";
            }

            return null;
        },
        name: "packem:native-node-module",
    };
};

export default nativeNodeModule;
