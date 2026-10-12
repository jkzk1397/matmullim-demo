// 최소 구조 HWPX 작성기 (예시 파일 생성용). 파서가 읽는 구조(hs:sec > hp:p > hp:run > hp:tbl)를 따른다.
// 한글(한컴오피스)에서 열리는지는 확인하지 못했다. 서식 정보는 최소한만 넣는다.
import JSZip from 'jszip';
import type { ParsedDocument, ParsedTable } from './types';

const NS =
  'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" ' +
  'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" ' +
  'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" ' +
  'xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container"';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let pid = 0;
const para = (text: string, inner = '') =>
  `<hp:p id="${pid++}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
  `<hp:run charPrIDRef="0">${inner}${text ? `<hp:t>${esc(text)}</hp:t>` : ''}</hp:run></hp:p>`;

function tableXml(t: ParsedTable, id: number): string {
  const covered = new Set<string>();
  const spanAt = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const s of t.spans) {
    spanAt.set(`${s.row},${s.col}`, s);
    for (let r = s.row; r < s.row + s.rowSpan; r++)
      for (let c = s.col; c < s.col + s.colSpan; c++) if (r !== s.row || c !== s.col) covered.add(`${r},${c}`);
  }
  const cols = t.rows[0]?.length ?? 0;
  const W = 42520;
  const cw = Math.floor(W / Math.max(cols, 1));
  const trs = t.rows
    .map((row, r) => {
      const tcs = row
        .map((text, c) => {
          if (covered.has(`${r},${c}`)) return '';
          const sp = spanAt.get(`${r},${c}`) ?? { rowSpan: 1, colSpan: 1 };
          const paras = (text.split('\n').length ? text.split('\n') : ['']).map((line) => para(line)).join('');
          return (
            `<hp:tc name="" header="${r === 0 ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="1">` +
            `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${paras}</hp:subList>` +
            `<hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="${sp.colSpan}" rowSpan="${sp.rowSpan}"/>` +
            `<hp:cellSz width="${cw * sp.colSpan}" height="1500"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`
          );
        })
        .join('');
      return `<hp:tr>${tcs}</hp:tr>`;
    })
    .join('');
  return (
    `<hp:tbl id="${1000 + id}" zOrder="${id}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${t.rows.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="1" noAdjust="0">` +
    `<hp:sz width="${W}" widthRelTo="ABSOLUTE" height="${1500 * t.rows.length}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
    `${trs}</hp:tbl>`
  );
}

const SEC_PR =
  '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">' +
  '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>' +
  '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>' +
  '<hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr>' +
  '</hp:secPr>';

const HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head ${NS} version="1.4" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
<hh:refList>
<hh:fontfaces itemCnt="1"><hh:fontface lang="HANGUL" fontCnt="1"><hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"/></hh:fontface></hh:fontfaces>
<hh:borderFills itemCnt="1"><hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">
<hh:leftBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:rightBorder type="SOLID" width="0.12 mm" color="#000000"/>
<hh:topBorder type="SOLID" width="0.12 mm" color="#000000"/><hh:bottomBorder type="SOLID" width="0.12 mm" color="#000000"/></hh:borderFill></hh:borderFills>
<hh:charProperties itemCnt="1"><hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/></hh:charPr></hh:charProperties>
<hh:paraProperties itemCnt="1"><hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="JUSTIFY" vertical="BASELINE"/></hh:paraPr></hh:paraProperties>
<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>
</hh:refList></hh:head>`;

export async function writeHwpx(doc: ParsedDocument): Promise<Uint8Array> {
  pid = 0;
  const body: string[] = [para(doc.title, SEC_PR)];
  doc.tables.forEach((t, i) => {
    body.push(para(t.title));
    body.push(para('', tableXml(t, i)));
  });
  const section = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hs:sec ${NS}>${body.join('')}</hs:sec>`;

  const zip = new JSZip();
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
  zip.file(
    'version.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="11, 0, 0, 0"/>',
  );
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>',
  );
  zip.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>');
  zip.file(
    'Contents/content.hpf',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${esc(doc.title)}</opf:title><opf:language>ko</opf:language></opf:metadata>` +
      '<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest>' +
      '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>',
  );
  zip.file('Contents/header.xml', HEADER);
  zip.file('Contents/section0.xml', section);
  zip.file('settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"/>');
  zip.file('Preview/PrvText.txt', [doc.title, ...doc.tables.flatMap((t) => [t.title, ...t.rows.map((r) => r.join('\t'))])].join('\r\n'));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
}
