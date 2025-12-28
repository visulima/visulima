/**
 * Settings app for dev toolbar
 * This is a placeholder - will be implemented with Preact components
 */

import type { DevToolbarApp } from '../../types/app.js';
import { SETTINGS_ICON } from '../../ui/icons/index.js';

export const settingsApp: DevToolbarApp = {
  id: 'dev-toolbar:settings',
  name: 'Settings',
  icon: SETTINGS_ICON,
  init(canvas, eventTarget, helpers) {
    // TODO: Implement settings UI with Preact
    const content = document.createElement('div');
    content.innerHTML = '<h2>Settings</h2><p>Settings panel coming soon...</p>';
    content.style.padding = '16px';
    content.style.color = 'white';
    canvas.appendChild(content);
  },
};
