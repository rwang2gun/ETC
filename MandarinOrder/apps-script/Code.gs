/**
 * MandarinOrder — Google Sheets 주문 등록 웹앱
 *
 * 시트: "성전 주문 설문지" (1qleFt66NoZgMmEnuXUdFuiHzYjrrTDpslIHRdQTOF8o)
 * 탭:   "2026 감귤 주문" (sheetId 611916439)
 *
 * 폼 페이로드의 lines[] 배열을 순회하며 한 라인당 한 행씩 append.
 * 5kg + 10kg 동시 주문 시 2행이 추가됨.
 */

const SPREADSHEET_ID = '1qleFt66NoZgMmEnuXUdFuiHzYjrrTDpslIHRdQTOF8o';
const SHEET_NAME = '2026 감귤 주문';

function doPost(e) {
  let parsed = null;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'no payload' });
    }
    parsed = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'invalid JSON: ' + err.message });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOut({ ok: false, error: 'lock timeout' });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonOut({ ok: false, error: 'sheet not found: ' + SHEET_NAME });
    }
    const rows = buildRows(sheet, parsed);
    if (rows.length === 0) {
      return jsonOut({ ok: false, error: 'no order lines' });
    }
    rows.forEach(function (row) { sheet.appendRow(row); });
    return jsonOut({ ok: true, rows: rows.length });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function buildRows(sheet, d) {
  const lines = Array.isArray(d.lines) ? d.lines : [];
  if (lines.length === 0) return [];

  // 마지막 데이터 행에서 번호 가져오기 (헤더만 있으면 1부터)
  const lastRow = sheet.getLastRow();
  let nextNo = 1;
  if (lastRow >= 2) {
    const lastNoCell = sheet.getRange(lastRow, 1).getValue();
    const parsedNo = (typeof lastNoCell === 'number')
      ? lastNoCell
      : parseInt(String(lastNoCell).replace(/[^\d]/g, ''), 10);
    if (!isNaN(parsedNo) && parsedNo > 0) nextNo = parsedNo + 1;
  }

  const ordererName = String(d.orderer_name || '').trim();
  const ordererPhone = String(d.orderer_phone || '').trim();
  const recvName = d.self_receive ? ordererName : String(d.receiver_name || '').trim();
  const recvPhone = d.self_receive ? ordererPhone : String(d.receiver_phone || '').trim();

  const ordererAddr = joinAddr(d.orderer_addr, d.orderer_detail);
  const receiverAddr = joinAddr(d.receiver_addr, d.receiver_detail);
  const recvAddr = d.self_receive ? ordererAddr : receiverAddr;

  const depositor = String(d.depositor || '').trim();

  return lines.map(function (line) {
    const subtotal = (typeof line.subtotal === 'number')
      ? line.subtotal
      : (Number(line.unit_price) || 0) * (Number(line.qty) || 0);
    const row = [
      nextNo++,                         // A 번호
      ordererName,                      // B 주문자
      ordererPhone,                     // C 주문자 연락처
      recvName,                         // D 받는 분
      recvPhone,                        // E 받는 분 연락처
      '',                               // F 추가연락처
      recvAddr,                         // G 받는 분 주소
      String(line.product || ''),       // H 상품 종류 (10KG / 5KG)
      Number(line.qty) || 0,            // I 수량
      formatWon(subtotal),              // J 금액 (₩33,000)
      depositor,                        // K 입금자명
      '',                               // L 입금 확인
      '',                               // M 입금일
      '',                               // N 배송일
    ];
    return row;
  });
}

function joinAddr(addr, detail) {
  const a = String(addr || '').trim();
  const b = String(detail || '').trim();
  if (a && b) return a + ' ' + b;
  return a || b;
}

function formatWon(n) {
  const v = Number(n) || 0;
  return '₩' + v.toLocaleString('en-US');
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonOut({ ok: true, message: 'MandarinOrder webhook — POST JSON only' });
}

/**
 * 편집기에서 직접 실행해 동작 확인용.
 * Apps Script 편집기 > 함수 선택: testAppend > 실행
 */
function testAppend() {
  const sample = {
    postData: {
      contents: JSON.stringify({
        variant: 'a',
        lines: [
          { product: '10KG', qty: 1, unit_price: 33000, subtotal: 33000 },
        ],
        orderer_name: '테스트',
        orderer_phone: '010-0000-0000',
        orderer_addr: '서울특별시 중구 세종대로 110',
        orderer_detail: '101호',
        self_receive: true,
        depositor: '테스트',
      }),
    },
  };
  const res = doPost(sample);
  Logger.log(res.getContent());
}
