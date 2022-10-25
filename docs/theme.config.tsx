import { useRouter } from "next/router";

// const Logo = ({ height }) => (
//
// );

const TITLE_WITH_TRANSLATIONS = {
    "en-US": "Visulima is the next-gen JavaScript framework for JAMStack blogs, sites & apps.",
};

const FEEDBACK_LINK_WITH_TRANSLATIONS = {
    "en-US": "Question? Give us feedback →",
};

export default {
    projectLink: "https://github.com/visulima/visulima",
    docsRepositoryBase: "https://github.com/visulima/visulima/blob/main/docs",
    titleSuffix: " – Visulima",
    search: true,
    unstable_flexsearch: true,
    floatTOC: true,
    feedbackLink: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { locale } = useRouter();
        return (
            FEEDBACK_LINK_WITH_TRANSLATIONS[locale]
            || FEEDBACK_LINK_WITH_TRANSLATIONS["en-US"]
        );
    },
    feedbackLabels: "feedback",
    logo: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { locale } = useRouter();
        return (
            <>
                {/* <Logo height={12} /> */}
                <span
                    className="mx-2 font-extrabold hidden md:inline select-none"
                    title={`Visulima: ${TITLE_WITH_TRANSLATIONS[locale] || ""}`}
                >
                    Visulima
                </span>
            </>
        );
    },
    head: ({ title, meta }) => {
        const ogImage = meta?.image
            || `https://visulima.com${
                title === "home"
                    ? ""
                    : `?title=${encodeURIComponent(title)}`
            }`;

        return (
            <>
                {/* Favicons, meta */}
                <link
                    rel="apple-touch-icon"
                    sizes="180x180"
                    href="/favicon/apple-touch-icon.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="32x32"
                    href="/favicon/favicon-32x32.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="16x16"
                    href="/favicon/favicon-16x16.png"
                />
                <link
                    rel="icon"
                    type="image/svg+xml"
                    href="/favicon/favicon.svg"
                />
                <link rel="manifest" href="/favicon/site.webmanifest" />
                <link
                    rel="mask-icon"
                    href="/favicon/safari-pinned-tab.svg"
                    color="#000000"
                />
                <meta name="msapplication-TileColor" content="#ffffff" />
                <meta httpEquiv="Content-Language" content="en" />
                <meta
                    name="description"
                    content={
                        meta?.description
                        || TITLE_WITH_TRANSLATIONS["en-US"]
                    }
                />
                <meta
                    name="og:description"
                    content={
                        meta?.description
                        || TITLE_WITH_TRANSLATIONS["en-US"]
                    }
                />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:site" content="@visulima" />
                <meta name="twitter:image" content={ogImage} />
                <meta
                    name="og:title"
                    content={
                        title
                            ? `${title} – Visulima`
                            : TITLE_WITH_TRANSLATIONS["en-US"]
                    }
                />
                <meta name="og:image" content={ogImage} />
                <meta name="apple-mobile-web-app-title" content="Visulima" />
            </>
        );
    },
    footerEditLink: ({ locale }) => {
        // eslint-disable-next-line radar/no-small-switch
        switch (locale) {
            default: {
                return "Edit this page on GitHub →";
            }
        }
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    footerText: ({ locale }) => {
        // switch (locale) {
        //     default:
        //         return (
        //
        //         );
        // }
    },
    i18n: [{ locale: "en-US", text: "English" }],
};
