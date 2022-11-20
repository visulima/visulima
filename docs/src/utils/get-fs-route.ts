const template = "https://nextra.vercel.app";

const getFSRoute = (asPath: string, locale?: string | undefined) => {
    // eslint-disable-next-line compat/compat
    const { pathname } = new URL(asPath, template);
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,no-useless-escape,prefer-regex-literals
    const cleanedPath = locale ? pathname.replace(new RegExp(`\.${locale}(\/|$)`), "$1") : pathname;

    return cleanedPath.replace(new RegExp("/index(/|$)"), "$1").split("#")[0] || "/";
};

export default getFSRoute;
