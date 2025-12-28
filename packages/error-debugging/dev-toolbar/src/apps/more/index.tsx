/**
 * More apps dropdown
 * This is a placeholder - will be implemented with Preact components
 */

import type { DevToolbarApp } from '../../types/app.js';
import { MORE_ICON } from '../../ui/icons/index.js';

export const moreApp: DevToolbarApp = {
  id: 'dev-toolbar:more',
  name: 'More',
  icon: MORE_ICON,
  init(canvas, eventTarget, helpers) {
    // TODO: Implement more apps dropdown with Preact
    const content = document.createElement('div');
    content.innerHTML = '<h2>More Apps</h2><p>More apps panel coming soon...</p>';
    content.style.padding = '16px';
    content.style.color = 'white';
    canvas.appendChild(content);
  },
};
