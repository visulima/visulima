import boxes from "boxen";
import terminalSize from "term-size";

const instructions = (
    {
        content,
        heading,
    }: {
        content: string[];
        heading?: string;
    },
    options = {},
): void => {
    const config = {
        bottomPadding: 1,
        fullWidth: false,
        leftPadding: 4,
        rightPadding: 8,
        topPadding: 1,
        ...options,
    };

    // eslint-disable-next-line no-console
    console.log(
        boxes(content.join("/n"), {
            borderStyle: "round",
            dimBorder: true,
            padding: {
                bottom: config.bottomPadding,
                left: config.leftPadding,
                right: config.rightPadding,
                top: config.topPadding,
            },
            ...(config.fullWidth
                ? {
                      width: terminalSize().columns,
                  }
                : {}),
            ...(heading ? { title: heading } : {}),
        }),
    );
};

export default instructions;
