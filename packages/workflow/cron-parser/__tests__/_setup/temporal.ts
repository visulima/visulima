import { Temporal } from "temporal-polyfill";

// Makes the runtime look like one with native Temporal, so the zone layer picks the Temporal backend.
(globalThis as { Temporal?: unknown }).Temporal = Temporal;
