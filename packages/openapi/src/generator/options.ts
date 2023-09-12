import type { Options } from "./types";

const exclude = [
    "coverage/**",
    ".github/**",
    "packages/*/test{,s}/**",
    "**/*.d.ts",
    "test{,s}/**",
    "test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}",
    "**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}",
    "**/__tests__/**",
    "**/{ava,babel,nyc}.config.{js,cjs,mjs}",
    "**/jest.config.{js,cjs,mjs,ts}",
    "**/{karma,rollup,webpack}.config.js",
    "**/.{eslint,mocha}rc.{js,cjs}",
    "**/.{travis,yarnrc}.yml",
    "**/{docker-compose,docker}.yml",
    "**/.yamllint.{yaml,yml}",
    "**/node_modules/**",
    "**/pnpm-lock.yaml",
    "**/pnpm-workspace.yaml",
    "**/{package,package-lock}.json",
    "**/yarn.lock",
    "**/package.json5",
    "**/.next/**",
];

const defaultOptions: Partial<Options> = {
    extensions: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml", ".json"],
    include: [],
    stopOnInvalid: true,
    verbose: false,
};

// eslint-disable-next-line import/prefer-default-export
export const resolveOptions = (options: Options | undefined): Required<Options> => {
    const resolved = { ...defaultOptions, ...options, exclude: [...exclude, ...(options?.exclude ?? [])] } as Required<Options>;

    if (resolved.include.length === 0) {
        throw new Error("No include paths specified");
    }

    if (resolved.outputFilePath === "") {
        throw new Error("No output file path specified");
    }

    return resolved;
};
