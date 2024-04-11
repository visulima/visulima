import { normalize } from "pathe";

const getEntrypointPaths = (path: string): string[] => {
    const segments = normalize(path).split("/");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return segments.map((_, index) => segments.slice(index).join("/")).filter(Boolean);
};

export default getEntrypointPaths;
