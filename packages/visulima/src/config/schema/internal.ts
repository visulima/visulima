import { z } from "zod";

const internal = z.object({
    _tsconfig: z.object({}).optional(),
    _tsconfigPath: z.string().optional(),
    _visulimaCacheDir: z.string().optional(),
    _visulimaConfigFile: z.string().optional(),
    _visulimaConfigFiles: z.array(z.string().optional()).default([]),
    _visulimaVersion: z.string().optional(),
});

export type InternalSchema = z.infer<typeof internal>;

export default internal;
