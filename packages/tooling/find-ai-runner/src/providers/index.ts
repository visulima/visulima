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

/**
 * All supported AI CLI provider configurations, keyed by name.
 *
 * Session-marker precedence does NOT depend on this key order: Qwen Code is a
 * gemini-cli fork that sets both `QWEN_CODE` and `GEMINI_CLI`, but the Gemini
 * marker explicitly excludes `QWEN_CODE` (see `gemini.ts`), so a Qwen session
 * is attributed to Qwen regardless of iteration order.
 */
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
