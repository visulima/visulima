/**
 * `@visulima/cron-parser/cloudflare` is the default entry with the `cloudflare` dialect already applied,
 * so a Worker's schedule does not have to be handed a dialect by hand. Everything the default entry
 * exports is here too.
 *
 * ```ts
 * import { parse } from "@visulima/cron-parser/cloudflare";
 *
 * parse("0 0 * * 1").next(); // Sunday, not Monday
 * parse("H * * * *"); // throws: Cloudflare has no hashed values
 * ```
 */
import type { CronExpression, CronExpressionOptions } from "./cron-expression";
import { parse as parseWithDialect } from "./cron-expression-parser";

/**
 * Parses a cron expression in the `cloudflare` dialect. An explicit `dialect` still wins.
 * @param expression The cron expression to parse.
 * @param [options] The options to use when parsing the expression.
 * @returns A CronExpression object.
 */
const parse = (expression: string, options: CronExpressionOptions = {}): CronExpression =>
    parseWithDialect(expression, { ...options, dialect: options.dialect ?? "cloudflare" });

export * from "./index";
export { parse };
