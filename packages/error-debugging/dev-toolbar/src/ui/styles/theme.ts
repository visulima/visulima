/**
 * Theme tokens matching Astro's dev-toolbar aesthetic
 */
export const theme = {
  colors: {
    background: 'linear-gradient(180deg, #13151A 0%, rgba(19, 21, 26, 0.88) 100%)',
    border: '#343841',
    text: '#ffffff',
    hover: 'rgba(255, 255, 255, 0.125)',
    active: '#474E5E',
    notification: {
      error: '#FF2525',
      warning: '#FFD700',
      info: '#3B82F6',
    },
  },
  shadow:
    '0px 0px 0px 0px rgba(19, 21, 26, 0.30), 0px 1px 2px 0px rgba(19, 21, 26, 0.29), 0px 4px 4px 0px rgba(19, 21, 26, 0.26), 0px 10px 6px 0px rgba(19, 21, 26, 0.15), 0px 17px 7px 0px rgba(19, 21, 26, 0.04), 0px 26px 7px 0px rgba(19, 21, 26, 0.01)',
} as const;
