import ExcelJS from 'exceljs';
import { parseImport } from './import-parser';
const headers = [
  'firstName',
  'lastName',
  'fatherName',
  'birthDate',
  'nationalId',
  'phone',
  'group',
];
describe('bounded CSV and XLSX parser', () => {
  it('parses Persian UTF-8 with a BOM and quoted CSV cells', async () => {
    const data = await parseImport(
      Buffer.from(
        '\uFEFF' +
          headers.join(',') +
          '\nعلی,"نام، خانوادگی",حسن,1392/01/01,0084575948,09123456789,رویش\n',
      ),
      'members.csv',
    );
    expect(data[0].lastName).toBe('نام، خانوادگی');
  });
  it('parses a workbook without formulas', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('اعضا');
    sheet.addRow(headers);
    sheet.addRow([
      'علی',
      'رضایی',
      'حسن',
      '1392/01/01',
      '0084575948',
      '09123456789',
      'رویش',
    ]);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    expect((await parseImport(buffer, 'members.xlsx')).length).toBe(1);
  });
  it('rejects formulas, corrupt archives, unknown headers, oversized files and too many rows', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('اعضا');
    sheet.addRow(headers);
    sheet.addRow([
      { formula: '1+1', result: 2 },
      'رضایی',
      'حسن',
      '1392/01/01',
      '0084575948',
      '09123456789',
      'رویش',
    ]);
    await expect(
      parseImport(Buffer.from(await book.xlsx.writeBuffer()), 'members.xlsx'),
    ).rejects.toThrow();
    await expect(
      parseImport(Buffer.from('bad archive'), 'members.xlsx'),
    ).rejects.toThrow();
    await expect(
      parseImport(Buffer.from('unknown\na\n'), 'members.csv'),
    ).rejects.toThrow();
    await expect(
      parseImport(Buffer.alloc(2 * 1024 * 1024 + 1), 'members.csv'),
    ).rejects.toThrow();
    await expect(
      parseImport(
        Buffer.from(headers.join(',') + '\n' + 'a,b,c,d,e,f,g\n'.repeat(1001)),
        'members.csv',
      ),
    ).rejects.toThrow();
  });
});
