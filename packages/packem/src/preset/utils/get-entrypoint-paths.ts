import { normalize } from "pathe";

const getEntrypointPaths = (path: string) => {
    const segments = normalize(path).split("/");

    return segments.map((_, index) => segments.slice(index).join("/")).filter(Boolean);
};

export default getEntrypointPaths;
