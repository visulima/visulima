declare module "regexparam" {
    // eslint-disable-next-line import/prefer-default-export -- external module type declaration mirrors actual API
    export function parse(
        route: RegExp | string,
        loose?: boolean,
    ): {
        keys: string[] | false;
        pattern: RegExp;
    };
}
