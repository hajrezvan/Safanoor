import { latinDigits, persianDigits } from '@safanoor/shared';

import { AdapterDateFnsJalali } from '@mui/x-date-pickers/AdapterDateFnsJalali';

export class PersianJalaliAdapter extends AdapterDateFnsJalali {
  constructor(...args: ConstructorParameters<typeof AdapterDateFnsJalali>) {
    super(...args);

    const formatByString = this.formatByString;
    const parse = this.parse;

    this.formatNumber = persianDigits;
    this.formatByString = (value, formatString) =>
      persianDigits(formatByString(value, formatString));
    this.parse = (value, formatString) => parse(latinDigits(value), formatString);
  }
}
