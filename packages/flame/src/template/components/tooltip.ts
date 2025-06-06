import infoIcon from "lucide-static/icons/info.svg";

const tooltip = ({ message }: { message?: string } = {}): {
    html: string;
    script: string;
} => {
    return {
        html: message
            ? `<div class="custom-tooltip-container relative inline-block ml-2">
          <button type="button" id="causes-tooltip-trigger" aria-describedby="causes-tooltip-content" class="inline-flex justify-center items-center gap-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
            <img src="${infoIcon}" alt="Info" class="w-4 h-4" />
          </button>
          <span id="causes-tooltip-content" class="opacity-0 invisible transition-opacity inline-block absolute z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded-sm shadow-xs dark:bg-slate-700 whitespace-normal" role="tooltip" style="left: 100%; top: 50%; transform: translateY(-50%) translateX(0.5rem); min-width: 200px;">
            ${message}
          </span>
        </div>`
            : "",
        script: `
window.addEventListener('load', () => {
    const trigger = document.getElementById('causes-tooltip-trigger');
    const tooltip = document.getElementById('causes-tooltip-content');
    
    if (trigger && tooltip) {
        const showTooltip = () => {
            tooltip.classList.remove('opacity-0', 'invisible');
            tooltip.classList.add('opacity-100', 'visible');
        };
    
        const hideTooltip = () => {
            tooltip.classList.remove('opacity-100', 'visible');
            tooltip.classList.add('opacity-0', 'invisible');
        };
    
        trigger.addEventListener('mouseenter', showTooltip);
        trigger.addEventListener('focus', showTooltip);
        trigger.addEventListener('mouseleave', hideTooltip);
        trigger.addEventListener('blur-sm', hideTooltip);
    } else {
        console.warn('Tooltip trigger or content element not found. Custom tooltip may not function.');
    }
});`,
    };
};

export default tooltip;
