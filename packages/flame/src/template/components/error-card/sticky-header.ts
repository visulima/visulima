const stickyHeader = (
    error: Error,
): {
    html: string;
    script: string;
} => {
    return {
        html: `<div id="error-card-sticky-header" class="fixed invisible bg-white container px-6 py-4 -top-40 z-10 rounded-b-lg transition-all duration-300 dark:shadow-none from-gray-700/50 via-transparent shadow-2xl shadow-gray-500/20">
    <span class="text-lg font-semibold text-gray-600 dark:text-gray-400">${error.message}</span>
</div>`,
        script: `window.addEventListener('load', () => {
    const errorCard = document.getElementById("error-card");
    const header = document.getElementById("error-card-sticky-header");
    const sticky = header.offsetTop;

    const stickyHeader = () => {
        const bounding = errorCard.getBoundingClientRect();

        if (bounding.bottom <= -15) {
            header.classList.remove("invisible");
            header.classList.remove("-top-40");

            header.classList.add("top-0");
            header.classList.add("visible");
        } else {
            header.classList.remove("top-0");
            header.classList.remove("visible");

            header.classList.add("invisible");
            header.classList.add("-top-40");
        }
    }

    stickyHeader();

    window.onscroll = () => {
        stickyHeader();
    };
});`,
    };
};

export default stickyHeader;
