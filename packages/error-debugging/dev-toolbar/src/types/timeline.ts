/**
 * Timeline event level
 */
export type TimelineEventLevel = 'info' | 'warning' | 'error';

/**
 * Timeline event
 */
export interface TimelineEvent {
  /**
   * Unique event ID
   */
  id: string;

  /**
   * Event title
   */
  title: string;

  /**
   * Optional subtitle
   */
  subtitle?: string;

  /**
   * Timestamp (milliseconds since epoch)
   */
  time: number;

  /**
   * Optional duration (milliseconds)
   */
  duration?: number;

  /**
   * Optional event data
   */
  data?: Record<string, any>;

  /**
   * Event level
   */
  level?: TimelineEventLevel;
}

/**
 * Timeline group
 */
export interface TimelineGroup {
  /**
   * Group ID
   */
  id: string;

  /**
   * Group label
   */
  label: string;

  /**
   * Group color (hex or CSS color)
   */
  color?: string;

  /**
   * Events in this group
   */
  events: TimelineEvent[];
}

/**
 * Default timeline groups
 */
export const DEFAULT_TIMELINE_GROUPS: readonly TimelineGroup[] = [
  {
    id: 'hmr',
    label: 'HMR Updates',
    color: '#10B981',
    events: [],
  },
  {
    id: 'network',
    label: 'Network',
    color: '#3B82F6',
    events: [],
  },
  {
    id: 'errors',
    label: 'Errors',
    color: '#EF4444',
    events: [],
  },
  {
    id: 'custom',
    label: 'Custom',
    color: '#8B5CF6',
    events: [],
  },
] as const;
