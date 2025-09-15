import { formatStacktrace, parseStacktrace } from "@visulima/error";
import type { ViteDevServer } from "vite";

import findModuleForPath from "../find-module-for-path";
import { normalizeIdCandidates } from "../normalize-id-candidates";
import resolveOriginalLocation from "../resolve-original-location";

export const remapStackToOriginal = async (server: ViteDevServer, stack: string, header?: { message?: string; name?: string }): Promise<string> => {
    const frames = parseStacktrace({ stack } as unknown as Error);
    const mapped = await Promise.all(
        frames.map(async (frame) => {
            const { file } = frame;
            const line = frame.line ?? 0;
            const column = frame.column ?? 0;

            if (!file || line <= 0 || column <= 0) {
                return frame;
            }

            try {
                const idCandidates = normalizeIdCandidates(file);
                const module_ = findModuleForPath(server, idCandidates);

                if (!module_) {
                    return frame;
                }

                const resolved = resolveOriginalLocation(module_, file, line, column);

                return { ...frame, column: resolved.fileColumn, file: resolved.filePath, line: resolved.fileLine };
            } catch {
                return frame;
            }
        }),
    );

    return formatStacktrace(mapped, { header });
};
