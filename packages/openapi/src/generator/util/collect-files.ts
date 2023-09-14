import { collect } from "@visulima/readdir";

const collectFiles = async (
    include: string[],
    exclude: string[],
    extensions: string[],
    verbose: boolean,
    followSymlinks: boolean,
): Promise<ReadonlyArray<string>> => {
    let files: string[] = [];
    // eslint-disable-next-line no-console
    console.log("\nStarting the search for OpenApi jsdoc files to parse...");

    // eslint-disable-next-line no-restricted-syntax
    for await (const directory of include) {
        files = [
            ...files,
            ...(await collect(directory, {
                extensions,
                followSymlinks,
                includeDirs: false,
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
                skip: exclude,
            })),
        ];

        if (verbose) {
            // eslint-disable-next-line no-console
            console.log(`Found ${files.length} files in "${directory}" directory`);
            // eslint-disable-next-line no-console
            console.log(files);
        }
    }

    return files;
};

export default collectFiles;
