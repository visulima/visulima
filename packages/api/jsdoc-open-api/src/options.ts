import { DEFAULT_EXCLUDE } from "./constants";

const DEFAULT_OPTIONS = {
    cwd: undefined,
    // Reuse the single source of truth so this list cannot drift from the excludes
    // actually applied by the CLI.
    exclude: [...DEFAULT_EXCLUDE],
    excludeNodeModules: true,
    extension: [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
    include: ["**"],
    verbose: true,
};

export default DEFAULT_OPTIONS;
