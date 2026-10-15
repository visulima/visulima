/**
 * `@visulima/cron-parser/cloudflare` is the default entry with the `cloudflare` dialect already applied,
 * so a Worker's schedule does not have to be handed a dialect by hand. Everything the default entry
 * exports is here too.
 *
 * ```ts
 * import { CronExpressionParser } from "@visulima/cron-parser/cloudflare";
 *
 * CronExpressionParser.parse("0 0 * * 1").next(); // Sunday, not Monday
 * CronExpressionParser.parse("H * * * *"); // throws: Cloudflare has no hashed values
 * ```
 */
import type { CronExpression, CronExpressionOptions } from "./cron-expression";
import { CronExpressionParser as DefaultParser } from "./cron-expression-parser";

/**
 * The default entry's parser, reading every expression in the `cloudflare` dialect unless the caller
 * names another one.
 */
class CloudflareCronExpressionParser extends DefaultParser {
    /**
     * Parses a cron expression in the `cloudflare` dialect. An explicit `dialect` still wins.
     * @param expression The cron expression to parse.
     * @param [options] The options to use when parsing the expression.
     * @returns A CronExpression object.
     */
    public static override parse(expression: string, options: CronExpressionOptions = {}): CronExpression {
        return super.parse(expression, { ...options, dialect: options.dialect ?? "cloudflare" });
    }
}

export * from "./index";
export { CloudflareCronExpressionParser as CronExpressionParser };
export default CloudflareCronExpressionParser;
