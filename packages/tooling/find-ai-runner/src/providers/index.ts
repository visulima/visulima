/**
 * Barrel assembling the provider configs into the `PROVIDERS` record. Lives
 * here (not in the package entrypoint) so both the binary-detection code in
 * `../index.ts` and the session detection in `../session.ts` can consume the
 * same table without a circular import.
 */
import type { AiProviderConfig, AiProviderName } from "../types";
import amp from "./amp";
import claude from "./claude";
import codex from "./codex";
import copilot from "./copilot";
import crush from "./crush";
import cursor from "./cursor";
import droid from "./droid";
import gemini from "./gemini";
import kimi from "./kimi";
import opencode from "./opencode";
import qwen from "./qwen";

/** All supported AI CLI provider configurations, keyed by name. */
const PROVIDERS: Record<AiProviderName, AiProviderConfig> = {
    amp,
    claude,
    codex,
    copilot,
    crush,
    cursor,
    droid,
    gemini,
    kimi,
    opencode,
    qwen,
};

export default PROVIDERS;
