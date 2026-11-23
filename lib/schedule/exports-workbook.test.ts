import { describe, expect, it } from "vitest";
import { createWorkbook } from "./exports-workbook";

describe("schedule Excel export", () => {
  it("stores labels as literal text and report amounts as numbers in an XLSX archive", () => {
    const file = createWorkbook([["=Čačak & <Bar>", 157.5, null]]);
    const zip = Buffer.from(file);
    const directory = zip.readUInt32LE(zip.length - 6);
    const archive = zip.toString("utf8");

    expect(zip.subarray(0, 4)).toEqual(Buffer.from("504b0304", "hex"));
    expect(zip.subarray(directory, directory + 4)).toEqual(Buffer.from("504b0102", "hex"));
    expect(archive).toContain("xl/worksheets/sheet1.xml");
    expect(archive).toContain('<c r="A1" t="inlineStr"><is><t xml:space="preserve">=Čačak &amp; &lt;Bar&gt;</t></is></c>');
    expect(archive).toContain('<c r="B1"><v>157.5</v></c>');
    expect(archive).not.toContain('<c r="C1"');
  });
});
