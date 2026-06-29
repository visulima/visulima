export type { CharacterResult } from "./checks/character";
export { analyzeCharacters } from "./checks/character";
export type { DisposableEmailOptions } from "./checks/disposable";
export { areDisposableEmails, isDisposableDomain, isDisposableEmail } from "./checks/disposable";
export type { FreeEmailOptions } from "./checks/free";
export { areFreeEmails, isFreeDomain, isFreeEmail } from "./checks/free";
export type { MxCheckOptions, MxCheckResult, MxRecord, MxResolution } from "./checks/mx";
export { checkMxRecords } from "./checks/mx";
export { isNoReply, isRoleAccount, NO_REPLY_PREFIXES, ROLE_ACCOUNT_PREFIXES } from "./checks/role";
export type { SmtpVerificationOptions, SmtpVerificationResult } from "./checks/smtp";
export { verifySmtp } from "./checks/smtp";
export type { SymbolResult } from "./checks/symbol";
export { analyzeSymbols } from "./checks/symbol";
// Checks
export { validateSyntax } from "./checks/syntax";
export type { TagResult } from "./checks/tag";
export { detectTag } from "./checks/tag";
export type { NameResult } from "./enrich/name";
export { parseName } from "./enrich/name";
// Enrichment
export type { MxProviderInfo, ProviderDetails, ProviderEnrichOptions } from "./enrich/provider";
export { classifyMx, classifyMxRecords, enrichProvider, isSecureEmailGateway } from "./enrich/provider";
export type { TypoOptions, TypoSuggestion } from "./enrich/typo";
export { sift3Distance, suggestDomain, suggestEmailTypo } from "./enrich/typo";
export type { AddressParts } from "./internal/address";
export { extractDomain, splitAddress } from "./internal/address";
// Caching primitives
export type { Cache, InMemoryCacheOptions } from "./internal/cache";
export { InMemoryCache } from "./internal/cache";
// Scoring
export type { ScoreInput, ScoreResult, ScoreWeights } from "./score";
export { DEFAULT_WEIGHTS, scoreReport } from "./score";
export type { DomainReport, EmailVerificationReport, VerificationState } from "./types";
// Orchestrator + aggregate types
export type { VerifyEmailOptions } from "./verify-email";
export { default as verifyEmail } from "./verify-email";
