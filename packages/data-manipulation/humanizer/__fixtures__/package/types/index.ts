// Compile-only fixture. Imports the published surface of @visulima/humanizer
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { duration, formatBytes } from "@visulima/humanizer";
import type { DurationLanguage, DurationUnitName, IntlLocale } from "@visulima/humanizer";

const durationOutput: string = duration(1000);
const bytesOutput: string = formatBytes(123_412_341);

const unitName: DurationUnitName = "h";
const locale: IntlLocale = "en";

declare const language: DurationLanguage;

export { bytesOutput, durationOutput, language, locale, unitName };
