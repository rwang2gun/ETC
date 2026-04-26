# MandarinOrder — Apps Script 배포 가이드

주문 폼이 보낸 JSON을 받아 Google Sheets `"2026 감귤 주문"` 탭에 행을 추가하는 웹앱.

## 0. 사전 정보

| 항목 | 값 |
|------|----|
| 시트 | [성전 주문 설문지](https://docs.google.com/spreadsheets/d/1qleFt66NoZgMmEnuXUdFuiHzYjrrTDpslIHRdQTOF8o/edit) |
| 탭 | `2026 감귤 주문` (gid 611916439) |
| 시트 ID | `1qleFt66NoZgMmEnuXUdFuiHzYjrrTDpslIHRdQTOF8o` (코드에 하드코딩됨) |

## 1. Apps Script 프로젝트 생성

권장 — **컨테이너 바인딩 방식**(시트에 종속). 시트 권한을 그대로 상속받아 권한 문제가 적습니다.

1. 시트 열기 → 메뉴 `확장 프로그램` → `Apps Script`
2. 좌측 파일 트리에서 `Code.gs` 열기
3. 기본 코드 모두 지우고, 이 폴더의 [`Code.gs`](./Code.gs) 내용 **전체** 붙여넣기
4. 우상단 **저장** (또는 `Ctrl+S`) → 프로젝트 이름은 `MandarinOrder Webhook` 정도로

> 만약 stand-alone(독립) 프로젝트로 만들었다면 시트 ID/탭 이름은 `Code.gs` 상단 상수에 이미 박혀 있어 그대로 동작합니다.

## 2. 동작 테스트 (배포 전)

배포 전에 함수 단위로 먼저 검증하면 권한 문제를 빨리 잡을 수 있습니다.

1. Apps Script 편집기 상단 함수 드롭다운에서 `testAppend` 선택 → ▶ **실행**
2. 첫 실행 시 권한 동의 화면이 뜸:
   - "이 앱은 Google에서 확인하지 않았습니다" 경고 → `고급` → `MandarinOrder Webhook(으)로 이동(안전하지 않음)` 클릭
   - 스프레드시트 접근 권한 허용
3. 실행 로그 (`보기 > 로그` 또는 `Ctrl+Enter`)에 `{"ok":true,"rows":1}` 가 찍히면 성공
4. 시트의 `2026 감귤 주문` 탭에 테스트 행이 추가됐는지 확인 (이름: 테스트, 10KG 1박스 ₩33,000)
5. 테스트 행은 시트에서 직접 삭제

## 3. 웹앱 배포

1. Apps Script 편집기 우상단 **배포** → **새 배포**
2. 톱니바퀴(⚙) 아이콘 → **웹 앱** 선택
3. 설정:
   - **설명**: `MandarinOrder v1` (자유)
   - **다음 사용자로 실행**: **나** (시트 소유자)
   - **액세스 권한이 있는 사용자**: **모든 사용자** ⚠️
4. **배포** 클릭
5. 권한 승인 (2번에서 이미 했으면 스킵)
6. **웹 앱 URL** 복사 — `https://script.google.com/macros/s/{ID}/exec` 형태

> ⚠️ "모든 사용자" 권한이 필수입니다. 익명 fetch가 들어와야 하므로 "Google 계정이 있는 모든 사용자"는 안 됩니다 (로그인 페이지로 리다이렉트됨).

## 4. 프론트에 URL 박기

복사한 웹 앱 URL을 [`MandarinOrder/index.html`](../index.html) 의 다음 줄에 붙여넣기:

```js
window.SHEET_ENDPOINT = 'https://script.google.com/macros/s/.../exec';
```

(현재는 빈 문자열 `''` 이라 데모 모드 — 콘솔에 페이로드만 출력됩니다.)

## 5. 폼에서 실주문 1건 테스트

1. `MandarinOrder/index.html` 을 브라우저에서 열기
2. 폼 채우고 주문 → 성공 화면 뜨면 시트 확인
3. 시트에 행이 정상 추가됐으면 끝

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|----|
| 콘솔에 `CORS` 에러 | `shared.jsx` 의 `Content-Type: text/plain` 유지 (이게 CORS preflight 회피 핵심). JSON 헤더로 바꾸면 막힘 |
| `Authorization required` HTML 응답 | 배포 시 "액세스 권한이 있는 사용자"를 **모든 사용자**가 아닌 다른 옵션으로 설정. 다시 배포 |
| `sheet not found: 2026 감귤 주문` | 탭 이름 변경됨. `Code.gs` 의 `SHEET_NAME` 수정 |
| `lock timeout` | 동시 주문이 20초 이상 걸림. 거의 발생 안 함 |
| `no order lines` | 폼이 5kg/10kg 둘 다 0박스로 보냄. 폼 검증 (`isValid`) 통과 못 했어야 정상 |

## 코드 변경 후 재배포

`Code.gs` 를 수정한 뒤에는 **반드시 새 버전을 배포**해야 라이브로 반영됩니다:

1. **배포** → **배포 관리**
2. 기존 배포의 ✏️ 연필 아이콘
3. 버전 드롭다운에서 **새 버전** 선택
4. **배포** — URL은 동일하게 유지됨 (`{ID}` 변경 없음)

> 새 배포(Deploy → New Deployment) 를 매번 만들면 URL이 매번 바뀌어 프론트도 같이 갱신해야 하므로 비추.
