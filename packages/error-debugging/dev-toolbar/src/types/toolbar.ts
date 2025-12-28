/**
 * Toolbar placement options
 */
export type ToolbarPlacement = 'bottom-left' | 'bottom-center' | 'bottom-right';

/**
 * Notification levels
 */
export type NotificationLevel = 'info' | 'warning' | 'error';

/**
 * Toolbar settings
 */
export interface ToolbarSettings {
  /**
   * Toolbar placement on screen
   */
  placement: ToolbarPlacement;

  /**
   * Whether toolbar is visible by default
   */
  defaultVisible: boolean;

  /**
   * Whether to show notifications
   */
  showNotifications: boolean;
}

/**
 * Default toolbar settings
 */
export const DEFAULT_TOOLBAR_SETTINGS: ToolbarSettings = {
  placement: 'bottom-center',
  defaultVisible: true,
  showNotifications: true,
} as const;
