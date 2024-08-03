import { z } from "zod";

const experimental = z.object({}).default({});

export type ExperimentalSchema = z.infer<typeof experimental>;

export default experimental;
