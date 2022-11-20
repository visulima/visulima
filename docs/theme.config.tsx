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
    project: { link: "https://github.com/visulima/visulima" },
    docsRepositoryBase: "https://github.com/visulima/visulima/blob/main/docs",
    titleSuffix: " – Visulima",
    unstable_flexsearch: true,
    toc: {
        float: true,
    },
    feedback: {
        labels: "feedback",
        content: () => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { locale } = useRouter();
            return FEEDBACK_LINK_WITH_TRANSLATIONS[locale] || FEEDBACK_LINK_WITH_TRANSLATIONS["en-US"];
        },
    },
    logo: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { locale } = useRouter();
        return (
            <>
                {/* <Logo height={12} /> */}
                <span className="mx-2 font-extrabold hidden md:inline select-none" title={`Visulima: ${TITLE_WITH_TRANSLATIONS[locale] || ""}`}>
                    Visulima
                </span>
            </>
        );
    },
    head: ({ title, meta }) => {
        const ogImage = meta?.image || `https://visulima.com${title === "home" ? "" : `?title=${encodeURIComponent(title)}`}`;

        return (
            <>
                {/* Favicons, meta */}
                <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
                <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
                <link rel="manifest" href="/favicon/site.webmanifest" />
                <link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#000000" />
                <meta name="msapplication-TileColor" content="#ffffff" />
                <meta httpEquiv="Content-Language" content="en" />
                <meta name="description" content={meta?.description || TITLE_WITH_TRANSLATIONS["en-US"]} />
                <meta name="og:description" content={meta?.description || TITLE_WITH_TRANSLATIONS["en-US"]} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:site" content="@visulima" />
                <meta name="twitter:image" content={ogImage} />
                <meta name="og:title" content={title ? `${title} – Visulima` : TITLE_WITH_TRANSLATIONS["en-US"]} />
                <meta name="og:image" content={ogImage} />
                <meta name="apple-mobile-web-app-title" content="Visulima" />
            </>
        );
    },
    editLink: {
        text: ({ locale }) => {
            // eslint-disable-next-line radar/no-small-switch
            switch (locale) {
                default: {
                    return "Edit this page on GitHub →";
                }
            }
        },
    },
    footer: {
        copyright: () => {
            return (
                <span className="text-sm text-gray-500 sm:text-center dark:text-gray-400 p-1">
                    © {new Date().getFullYear()} Visulima <br /> All Rights Reserved.
                </span>
            );
        },
        component: () => {
            const linkClasses =
                "my-1 scroll-my-6 scroll-py-6 inline-block w-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 contrast-more:text-gray-900 contrast-more:underline contrast-more:dark:text-gray-50";

            return (
                <div>
                    <div>
                        <p className="text-sm font-semibold tracking-widest text-gray-400 uppercase">Highlights</p>
                        <ul className="mt-6 space-y-4">
                            <li>
                                <a href="#" title="" className={linkClasses}>
                                    {" "}
                                    About{" "}
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            );
        },
    },
    // hero: {
    //     height: 300,
    //     component: ({ route }) => {
    //         console.log(route);
    //
    //         if (route === "/index.en-US") {
    //              return (<div></div>);
    //         }
    //
    //         return null;
    //     },
    // },
    i18n: [{ locale: "en-US", text: "English" }],
};
