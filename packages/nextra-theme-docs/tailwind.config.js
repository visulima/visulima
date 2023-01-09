const colors = require("tailwindcss/colors");

const makePrimaryColor = (l) => ({ opacityValue }) => {
    if (opacityValue === undefined) {
        return `hsl(var(--nextra-primary-hue) 100% ${l}%)`;
    }
    return `hsl(var(--nextra-primary-hue) 100% ${l}% / ${opacityValue})`;
};

module.exports = {
    corePlugins: {
        preflight: process.env.PREFLIGHT === "yes",
    },
    content: ["./src/**/*.tsx", "./components/**/*.js", "./pages/**/*.{md,mdx}", "./theme.config.tsx"],
    theme: {
        screens: {
            sm: "640px",
            md: "768px",
            lg: "1024px",
            xl: "1280px",
            "2xl": "1536px",
        },
        fontSize: {
            xs: ["0.75rem", { lineHeight: "1rem" }],
            sm: ["0.875rem", { lineHeight: "1.25rem" }],
            base: ["1rem", { lineHeight: "1.5rem" }],
            lg: ["1.125rem", { lineHeight: "1.75rem" }],
            xl: ["1.25rem", { lineHeight: "2rem" }],
            "2xl": ["1.5rem", { lineHeight: "2.5rem" }],
            "3xl": ["2rem", { lineHeight: "2.5rem" }],
            "4xl": ["2.5rem", { lineHeight: "3rem" }],
            "5xl": ["3rem", { lineHeight: "3.5rem" }],
            "6xl": ["3.75rem", { lineHeight: "1" }],
            "7xl": ["4.5rem", { lineHeight: "1" }],
            "8xl": ["6rem", { lineHeight: "1" }],
            "9xl": ["8rem", { lineHeight: "1" }],
        },
        colors: {
            transparent: "transparent",
            current: "currentColor",
            black: "#000",
            white: "#fff",
            gray: colors.gray,
            slate: colors.slate,
            neutral: colors.neutral,
            red: colors.red,
            orange: colors.orange,
            blue: colors.blue,
            yellow: colors.yellow,
            emerald: colors.emerald,
            darker: {
                700: "#171923",
                800: "#12141c",
                900: "#0c0d12",
            },
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
        },
        extend: {
            colors: {
                dark: "#111",
            },
            rotate: {
                270: "270deg",
            },
            letterSpacing: {
                tight: "-0.015em",
            },
        },
    },
    darkMode: ["class", 'html[class~="dark"]'],
    plugins: [require("@tailwindcss/typography"), require("tailwindcss-hyphens")],
};
