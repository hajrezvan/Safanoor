import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';

const MAX_ROWS = 1000;
const MAX_EXPANDED = 16 * 1024 * 1024;
const headers: Record<string, string> = {
  firstName: 'firstName',
  lastName: 'lastName',
  fatherName: 'fatherName',
  birthDate: 'birthDate',
  nationalId: 'nationalId',
  phone: 'phone',
  group: 'group',
  نام: 'firstName',
  'نام خانوادگی': 'lastName',
  'نام پدر': 'fatherName',
  'تاریخ تولد': 'birthDate',
  'کد ملی': 'nationalId',
  تلفن: 'phone',
  گروه: 'group',
};
function validateArchive(buffer: Buffer): void {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new BadRequestException('فایل اکسل معتبر نیست.');
  const entries = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  let expanded = 0;
  if (entries > 500 || entries === 65535)
    throw new BadRequestException('ساختار اکسل بیش از حد بزرگ است.');
  for (let i = 0; i < entries; i++) {
    if (
      cursor + 46 > buffer.length ||
      buffer.readUInt32LE(cursor) !== 0x02014b50
    )
      throw new BadRequestException('فایل اکسل معتبر نیست.');
    const method = buffer.readUInt16LE(cursor + 10);
    const size = buffer.readUInt32LE(cursor + 20);
    const local = buffer.readUInt32LE(cursor + 42);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString('utf8');
    if (
      name.includes('..') ||
      name.startsWith('/') ||
      local + 30 > buffer.length ||
      buffer.readUInt32LE(local) !== 0x04034b50 ||
      (buffer.readUInt16LE(cursor + 8) & 1) !== 0
    )
      throw new BadRequestException('ساختار اکسل مجاز نیست.');
    const start =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (start + size > buffer.length)
      throw new BadRequestException('فایل اکسل ناقص است.');
    const compressed = buffer.subarray(start, start + size);
    let actual: number;
    try {
      actual =
        method === 0
          ? compressed.length
          : method === 8
            ? inflateRawSync(compressed, {
                maxOutputLength: MAX_EXPANDED - expanded,
              }).length
            : MAX_EXPANDED + 1;
    } catch {
      throw new BadRequestException('فایل اکسل بیش از حد بزرگ یا نامعتبر است.');
    }
    expanded += actual;
    if (expanded > MAX_EXPANDED)
      throw new BadRequestException('حجم بازشدهٔ اکسل بیش از حد مجاز است.');
    cursor +=
      46 +
      nameLength +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32);
  }
}
export async function parseImport(
  buffer: Buffer,
  filename: string,
): Promise<Record<string, string>[]> {
  if (buffer.length > 2 * 1024 * 1024 || buffer.length === 0)
    throw new BadRequestException('فایل باید حداکثر ۲ مگابایت باشد.');
  let grid: string[][];
  if (filename.toLowerCase().endsWith('.csv')) {
    try {
      grid = parse(buffer, {
        bom: true,
        trim: true,
        skip_empty_lines: true,
        max_record_size: 8192,
        relax_column_count: false,
        to: MAX_ROWS + 2,
      });
    } catch {
      throw new BadRequestException('ساختار CSV معتبر نیست.');
    }
  } else if (filename.toLowerCase().endsWith('.xlsx')) {
    validateArchive(buffer);
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException('فایل اکسل معتبر نیست.');
    }
    if (workbook.worksheets.length !== 1)
      throw new BadRequestException('فایل اکسل باید یک برگه داشته باشد.');
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 10)
      throw new BadRequestException('حداکثر ۱۰۰۰ ردیف مجاز است.');
    grid = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      for (let i = 1; i <= sheet.columnCount; i++) {
        const value = row.getCell(i).value;
        if (
          value !== null &&
          value !== undefined &&
          typeof value !== 'string' &&
          typeof value !== 'number'
        )
          throw new BadRequestException(
            'فرمول، پیوند و تاریخ خودکار اکسل مجاز نیست؛ مقادیر را به‌صورت متن وارد کنید.',
          );
        values.push(String(value ?? '').trim());
      }
      grid.push(values);
    });
  } else throw new BadRequestException('فقط CSV یا XLSX مجاز است.');
  const names = grid.shift()?.map((name) => headers[name]);
  if (
    !names ||
    names.length !== 7 ||
    names.some((name) => !name) ||
    new Set(names).size !== 7
  )
    throw new BadRequestException(
      'ستون‌های نام، نام خانوادگی، نام پدر، تاریخ تولد، کد ملی، تلفن و گروه الزامی‌اند.',
    );
  if (!grid.length || grid.length > MAX_ROWS)
    throw new BadRequestException('بین ۱ و ۱۰۰۰ ردیف وارد کنید.');
  return grid.map((values) =>
    Object.fromEntries(names.map((name, index) => [name, values[index] ?? ''])),
  );
}
