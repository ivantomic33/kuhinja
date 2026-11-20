import { escapeMarkup } from "./exports-preview";

const spreadsheetMime = "application/vnd.openxmlformats-officedocument.spreadsheetml";
const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const packageNamespace = "http://schemas.openxmlformats.org/package/2006";
const relationshipNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const encoder = new TextEncoder();

function columnName(column: number): string {
  const letter = String.fromCharCode(65 + column % 26);
  return column < 26 ? letter : columnName(Math.floor(column / 26) - 1) + letter;
}

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function storedZip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const entries = Object.entries(files).map(([path, xml]) => ({
    name: encoder.encode(path),
    data: encoder.encode(xmlHeader + xml),
  }));
  const dataSize = entries.reduce((size, { name, data }) => size + 30 + name.length + data.length, 0);
  const directorySize = entries.reduce((size, { name }) => size + 46 + name.length, 0);
  const zip = new Uint8Array(dataSize + directorySize + 22);
  const view = new DataView(zip.buffer);
  const write16 = (offset: number, value: number) => view.setUint16(offset, value, true);
  const write32 = (offset: number, value: number) => view.setUint32(offset, value, true);
  let local = 0;
  let directory = dataSize;

  for (const { name, data } of entries) {
    const crc = crc32(data);
    write32(local, 0x04034b50);
    write16(local + 4, 20);
    write16(local + 12, 33);
    write32(local + 14, crc);
    write32(local + 18, data.length);
    write32(local + 22, data.length);
    write16(local + 26, name.length);
    zip.set(name, local + 30);
    zip.set(data, local + 30 + name.length);

    write32(directory, 0x02014b50);
    write16(directory + 4, 20);
    write16(directory + 6, 20);
    write16(directory + 14, 33);
    write32(directory + 16, crc);
    write32(directory + 20, data.length);
    write32(directory + 24, data.length);
    write16(directory + 28, name.length);
    write32(directory + 42, local);
    zip.set(name, directory + 46);

    local += 30 + name.length + data.length;
    directory += 46 + name.length;
  }

  write32(directory, 0x06054b50);
  write16(directory + 8, entries.length);
  write16(directory + 10, entries.length);
  write32(directory + 12, directorySize);
  write32(directory + 16, dataSize);
  return zip;
}

export function createWorkbook(rows: (string | number | null)[][]): Uint8Array<ArrayBuffer> {
  const sheetRows = rows.map((row, index) => {
    const number = index + 1;
    const cells = row.map((value, column) => {
      const address = `${columnName(column)}${number}`;
      if (typeof value === "string") {
        const text = escapeMarkup(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "");
        return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
      }
      return value !== null && Number.isFinite(value) ? `<c r="${address}"><v>${value}</v></c>` : "";
    }).join("");
    return `<row r="${number}">${cells}</row>`;
  }).join("");

  return storedZip({
    "[Content_Types].xml": `<Types xmlns="${packageNamespace}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${spreadsheetMime}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${spreadsheetMime}.worksheet+xml"/></Types>`,
    "_rels/.rels": `<Relationships xmlns="${packageNamespace}/relationships"><Relationship Id="rId1" Type="${relationshipNamespace}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="${spreadsheetNamespace}" xmlns:r="${relationshipNamespace}"><sheets><sheet name="Sati" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="${packageNamespace}/relationships"><Relationship Id="rId1" Type="${relationshipNamespace}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="${spreadsheetNamespace}"><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="9" width="16" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
}

export function workbookBlob(rows: (string | number | null)[][]): Blob {
  return new Blob([createWorkbook(rows)], { type: `${spreadsheetMime}.sheet` });
}
