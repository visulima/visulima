import { join } from "path";
import fs from 'fs'
import { collect } from "@visulima/readdir";

const apiFolders = ["pages/api", "src/pages/api"];

const isDirectory = (path: string): boolean => fs.lstatSync(path).isDirectory()

const collectApiFiles = async (dir: string, verbose: boolean = false) => {
    const collected = await collect(dir, {
                    extensions: [".js", ".cjs", ".mjs", ".ts"],
                    minimatchOptions: {
                        match: {
                            debug: verbose,
                            matchBase: true,
                        },
                        skip: {
                            debug: verbose,
                            matchBase: true,
                        },
                    },
                });


}

const findApiFolder = async (path: string = "") => {
    const routePath = join(process.cwd(), path);

    // src/pages will be ignored if pages is present in the root directory
    if (isDirectory(join(routePath, "pages/api"))) {

    } else {
        const apiFolder = join(routePath, "src/pages/api");

        if (isDirectory(apiFolder)) {
            apiFolders.push(apiFolder);
        }
    }
};
