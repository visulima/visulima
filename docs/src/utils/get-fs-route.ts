const template = "https://nextra.vercel.app";

const getFSRoute = (asPath: string, locale?: string | undefined) => {
    const { pathname } = new URL(asPath, template);
    const cleanedPath = locale ? pathname.replace(new RegExp(`\.${locale}(\/|$)`), "$1") : pathname;

    return cleanedPath.replace(new RegExp("/index(/|$)"), "$1").split("#")[0] || "/";
};

export default getFSRoute;
