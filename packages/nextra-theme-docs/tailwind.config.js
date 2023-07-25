const colors = require("tailwindcss/colors");

const makePrimaryColor =
    (l) =>
    ({ opacityValue }) => {
        if (opacityValue === undefined) {
            return `hsl(var(--nextra-primary-hue) 100% ${l}%)`;
        }
        return `hsl(var(--nextra-primary-hue) 100% ${l}% / ${opacityValue})`;
    };

module.exports = {
    content: ["./src/**/*.tsx", "./components/**/*.js", "./pages/**/*.{md,mdx}", "./theme.config.tsx"],
    corePlugins: {
        preflight: process.env.PREFLIGHT === "yes",
    },
    darkMode: ["class", 'html[class~="dark"]'],
    plugins: [require("@tailwindcss/typography"), require("tailwindcss-hyphens")],
    theme: {
        colors: {
            black: "#000",
            blue: colors.blue,
            current: "currentColor",
            darker: {
                700: "#171923",
                800: "#12141c",
                900: "#0c0d12",
            },
            emerald: colors.emerald,
            gray: colors.gray,
            neutral: colors.neutral,
            orange: colors.orange,
            primary: {
                50: makePrimaryColor(97),
                100: makePrimaryColor(94),
                200: makePrimaryColor(86),
                300: makePrimaryColor(77),
                400: makePrimaryColor(66),
                500: makePrimaryColor(50),
                600: makePrimaryColor(45),
                700: makePrimaryColor(39),
                750: makePrimaryColor(35),
                800: makePrimaryColor(32),
                900: makePrimaryColor(24),
                1000: makePrimaryColor(12),
            },
            red: colors.red,
            slate: colors.slate,
            transparent: "transparent",
            white: "#fff",
            yellow: colors.yellow,
        },
        extend: {
            colors: {
                dark: "#111",
            },
            letterSpacing: {
                tight: "-0.015em",
            },
            rotate: {
                270: "270deg",
            },
        },
        fontSize: {
            "2xl": ["1.5rem", { lineHeight: "2.5rem" }],
            "3xl": ["2rem", { lineHeight: "2.5rem" }],
            "4xl": ["2.5rem", { lineHeight: "3rem" }],
            "5xl": ["3rem", { lineHeight: "3.5rem" }],
            "6xl": ["3.75rem", { lineHeight: "1" }],
            "7xl": ["4.5rem", { lineHeight: "1" }],
            "8xl": ["6rem", { lineHeight: "1" }],
            "9xl": ["8rem", { lineHeight: "1" }],
            base: ["1rem", { lineHeight: "1.5rem" }],
            lg: ["1.125rem", { lineHeight: "1.75rem" }],
            sm: ["0.875rem", { lineHeight: "1.25rem" }],
            xl: ["1.25rem", { lineHeight: "2rem" }],
            xs: ["0.75rem", { lineHeight: "1rem" }],
        },
        screens: {
            "2xl": "1536px",
            lg: "1024px",
            md: "768px",
            sm: "640px",
            xl: "1280px",
        },
    },
};
