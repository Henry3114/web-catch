"use strict";
(() => {
  if (globalThis.VisualXlsx) return;
  const encoder = new TextEncoder();
  const safe = value => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "");
  const xml = value => safe(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  function column(n) {
    let out = "";
    for (; n; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out;
    return out;
  }
  function sheet(rows) {
    const body = rows.map((row, r) => `<row r="${r + 1}"${r ? ' ht="90" customHeight="1"' : ""}>${row.map((v, c) => `<c r="${column(c + 1)}${r + 1}" t="inlineStr" s="${r ? 1 : 2}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join("")}</row>`).join("");
    return declaration + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${rows[0].length}" width="30" customWidth="1"/></cols><sheetData>${body}</sheetData><autoFilter ref="A1:${column(rows[0].length)}${rows.length}"/></worksheet>`;
  }
  const crcTable = Array.from({length: 256}, (_, i) => {
    for (let j = 0; j < 8; j++) i = (i & 1) ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
    return i >>> 0;
  });
  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function concat(chunks) {
    const out = new Uint8Array(chunks.reduce((n, item) => n + item.length, 0));
    let offset = 0;
    for (const chunk of chunks) {out.set(chunk, offset); offset += chunk.length;}
    return out;
  }
  // 标准 ZIP STORE + Office Open XML；不下载或执行第三方脚本。
  function zip(files) {
    const locals = [], central = [];
    let offset = 0;
    for (const [filename, content] of Object.entries(files)) {
      const name = encoder.encode(filename), data = typeof content === 'string' ? encoder.encode(content) : content, crc = crc32(data);
      const local = new Uint8Array(30 + name.length), view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
      view.setUint16(12, 33, true); view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); local.set(name, 30);
      const directory = new Uint8Array(46 + name.length), dv = new DataView(directory.buffer);
      dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true); dv.setUint16(8, 0x800, true); dv.setUint16(14, 33, true); dv.setUint32(16, crc, true); dv.setUint32(20, data.length, true); dv.setUint32(24, data.length, true); dv.setUint16(28, name.length, true); dv.setUint32(42, offset, true); directory.set(name, 46);
      locals.push(local, data); central.push(directory); offset += local.length + data.length;
    }
    const directory = concat(central), end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true); ev.setUint32(12, directory.length, true); ev.setUint32(16, offset, true);
    return concat([...locals, directory, end]);
  }
  function createWorkbook(records, fields, {dropEmpty = true, errors = []} = {}) {
    const all = [...fields, {id: '_source', name: '来源页面'}, {id: '_time', name: '采集时间'}];
    const columns = all.filter(f => !dropEmpty || records.some(r => safe(r[f.id]).trim()));
    if (!columns.length) columns.push({id: '_source', name: '来源页面'});
    const overflow = [['记录序号', '字段', '分段', '完整内容（按序拼接）']];
    const rows = [columns.map(f => f.name), ...records.map((record, row) => columns.map(f => {
      const text = safe(record[f.id]);
      if (text.length <= 32767) return text;
      const chars = Array.from(text);
      for (let start = 0; start < chars.length; start += 15000) overflow.push([row + 1, f.name, start / 15000 + 1, chars.slice(start, start + 15000).join('')]);
      return chars.slice(0, 15000).join('') + '\n【完整内容见长文本表】';
    }))];
    const tabs = [{name:'采集结果', rows}];
    if (overflow.length > 1) tabs.push({name:'长文本', rows:overflow});
    if (errors.length) tabs.push({name:'采集异常', rows:[['页面','原因'], ...errors.map(e => [e.url || '', e.message || String(e)])]});
    const files = {
      '[Content_Types].xml': declaration + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tabs.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
      '_rels/.rels': declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': declaration + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs.map((t,i)=>`<sheet name="${xml(t.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': declaration + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabs.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml': declaration + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="等线"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B67"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    };
    tabs.forEach((tab,i) => {files[`xl/worksheets/sheet${i+1}.xml`] = sheet(tab.rows);});
    return zip(files);
  }
  globalThis.VisualXlsx = {createWorkbook};
})();
