// todo: remove this for revert desktop size

import { UI_CONFIG } from 'src/global-config';

const breakpoints = UI_CONFIG.mobileOnly
  ? {
      values: {
        xs: 0,
        sm: 60000,
        md: 90000,
        lg: 120000,
        xl: 153600,
      },
    }
  : {};

export default breakpoints;
