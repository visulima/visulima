/**
 * Timeline app for viewing events
 * This is a placeholder - will be implemented with Preact components
 */

import type { DevToolbarApp } from '../../types/app.js';
import { TIMELINE_ICON } from '../../ui/icons/index.js';

export const timelineApp: DevToolbarApp = {
  id: 'dev-toolbar:timeline',
  name: 'Timeline',
  icon: TIMELINE_ICON,
  init(canvas, eventTarget, helpers) {
    // TODO: Implement timeline viewer with Preact
    const content = document.createElement('div');
    content.innerHTML = '<h2>Timeline</h2><p>Timeline viewer coming soon...</p>';
    content.style.padding = '16px';
    content.style.color = 'white';
    canvas.appendChild(content);
  },
};
