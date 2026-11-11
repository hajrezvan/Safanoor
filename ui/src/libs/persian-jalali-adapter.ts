import { latinDigits, persianDigits } from '@safanoor/shared';

import { AdapterDateFnsJalali } from '@mui/x-date-pickers/AdapterDateFnsJalali';

export class PersianJalaliAdapter extends AdapterDateFnsJalali {
  constructor(...args: ConstructorParameters<typeof AdapterDateFnsJalali>) {
    super(...args);

    const formatByString = this.formatByString.bind(this);
    const parse = this.parse.bind(this);

    // date-fns stores yyyy/yy as section names with no maxLength. Dense fields
    // ask for maxLength once Persian digits hide the ASCII year-padding probe
    // (`0001` becomes `۰۰۰۱`, which does not start with "0").
    this.formatTokenMap = {
      ...this.formatTokenMap,
      yy: { sectionType: 'year', contentType: 'digit', maxLength: 2 },
      yyyy: { sectionType: 'year', contentType: 'digit', maxLength: 4 },
    };
    this.formatNumber = persianDigits;
    this.formatByString = (value, formatString) => {
      // MUI reads section text with Number(), which is NaN for Persian digits,
      // then formats that invalid date. date-fns throws and takes the page down.
      if (!(value instanceof Date) || Number.isNaN(value.valueOf())) return '';
      return persianDigits(formatByString(value, formatString));
    };
    this.parse = (value, formatString) => parse(latinDigits(value), formatString);
  }
}
