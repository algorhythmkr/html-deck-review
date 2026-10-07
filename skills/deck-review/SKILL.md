---
name: deck-review
description: 이미 만든 HTML 슬라이드 덱(사업계획서·IR·발표자료)을 검토하고 피드백을 주고받는 스킬(덱을 새로 만들지 않는다). 덱에 슬라이드별 피드백 창과 하단 메뉴(이전/다음·슬라이드 이동·전체 보기·전체 화면·인쇄/PDF)를 설치·갱신하고, 검토자가 남긴 버전별 피드백 JSON(덱_v1.1_feedback.json)을 읽어 그 버전의 의견만 반영한 다음 버전 파일을 만든다. headless 레이아웃 검수와 16:9 벡터 PDF 출력 포함. "피드백 창 넣어줘", "하단 메뉴/PDF 버튼 달아줘", "피드백 반영해줘", "v1.1 피드백 반영", "다음 버전으로 수정", "add a feedback panel to this deck", "apply reviewer feedback", "review tools in English", "영문 피드백 창" 요청 시 사용.
argument-hint: [덱 HTML 경로] [피드백 JSON 경로(선택)]
---

# deck-review: HTML 덱 피드백 셸 설치 · 버전별 피드백 반영

HTML 단일 파일 덱을 **원본(single source of truth)** 으로 두고, 검토 → 수정 → 재검토 사이클을 돌리는 스킬이다.
셸(피드백 창 + 하단 메뉴)은 덱 콘텐츠와 분리된 `rv-` 접두어 CSS/JS 블록이라, 덱 디자인을 건드리지 않고 넣고 뺄 수 있다.
덱을 새로 만들거나 디자인을 바꾸는 스킬이 아니다. 덱 제작은 다른 도구(ir-deck 등)가 맡고, 이 스킬은 기존 덱의 검토·피드백·반영만 다룬다.

```
assets/review-shell.css · review-shell.js   셸 런타임 (덱에 인라인으로 삽입됨)
scripts/apply_shell.py      셸 설치·갱신 (재실행 안전, 구형 뷰어 자동 이전)
scripts/feedback_report.py  해당 버전 피드백 JSON → 수정 작업 목록
scripts/check_deck.py       headless 검수: 슬라이드 밖으로 나간 요소·잘린 글자
scripts/export_pdf.py       16:9(또는 A4) 여백 없는 벡터 PDF
references/deck-contract.md   덱 마크업 규약·설정 항목 전체
references/feedback-format.md 피드백 JSON 스키마·버전 규칙·영역 정보 형식
references/editing-guide.md   사업계획서·IR 덱 수정 원칙과 함정
```

스크립트는 Python 3.9+ 표준 라이브러리만 쓴다. 검수·PDF에는 Chrome/Edge/Chromium이 필요하다(`DECK_REVIEW_BROWSER`로 경로 지정 가능).
아래 명령의 `$S`는 이 스킬의 `scripts/` 폴더 경로다.

## 핵심 규칙: 피드백은 버전별로 분리된다

```
덱_v1.1.html ──검토──▶ 덱_v1.1_feedback.json ──반영──▶ 덱_v1.2.html ──검토──▶ 덱_v1.2_feedback.json ──▶ 덱_v1.3.html …
```

- HTML 버전마다 피드백 파일이 따로 생긴다. 파일명은 `{deckId}_{version}_feedback.json`이 기본이며 `{version}`은 항상 들어간다.
- 브라우저 저장 공간도 버전별로 나뉜다. **새 버전 HTML을 열면 피드백 창은 비어 있고**, 저장하면 새 버전 이름의 JSON이 만들어진다. 이전 버전 의견은 새 버전 화면으로 넘어오지 않는다.
- 피드백 창의 불러오기·저장은 현재 버전 JSON만 받는다. 다른 버전 파일을 고르면 거부한다.
- 업데이트할 때는 **수정 대상 버전의 피드백만** 반영한다. v1.1 → v1.2 작업에는 `덱_v1.1_feedback.json`(같은 버전의 다른 검토자 파일 포함)만 쓴다. 이전 버전(v1.0) 피드백은 이미 v1.1에서 처리됐으므로 다시 반영하지 않는다.

## 작업 A. 셸 설치·갱신

1. 덱이 규약을 만족하는지 본다: 슬라이드마다 `class="slide"` 요소, 고정 크기(기본 1280×720), `</head>`·`</body>` 존재. 상세는 `references/deck-contract.md`.
2. **새 버전 파일로 출력**한다. 원본을 덮어쓰지 않는다.
   ```bash
   python $S/apply_shell.py 덱_v1.0.html -o 덱_v1.1.html --deck-id my-deck --title "OO사업 발표자료"
   ```
   - `--deck-id`는 덱 수명 동안 **절대 바꾸지 않는다**. 피드백 JSON 검증이 이 값으로 묶인다.
   - 버전은 출력 파일명의 `_v1.1`에서 자동으로 읽는다(`--version`으로 지정 가능). 이 버전이 피드백 파일명·저장 공간을 결정하므로 **HTML 파일명에 반드시 `_v버전`을 넣는다.**
   - 언어: 검토 도구 문구는 기본 `--lang auto`(덱의 `<html lang>`을 따름)이고, 하단 메뉴의 `EN` / `한국어` 버튼으로 검토자가 언제든 바꿀 수 있다. 영어 검토자에게 보낼 덱이면 `--lang en`으로 시작 언어를 고정하고, 전환 버튼을 숨기려면 `--no-lang-switch`를 쓴다. 링크로 보낼 때는 `덱.html?lang=en`도 된다. 덱 본문은 번역하지 않는다.
   - 선택: `--print-size a4`, `--brand "#99157a"`, `--feedback-file "{deckId}_{version}_feedback.json"`(템플릿, `{version}`이 없으면 자동 삽입), `--panel-guide "구성 안내 문구"`, `--slide-size 1920x1080`, `--panel-closed`, `--config cfg.json`.
   - 덮어써야 하면 `--in-place`를 쓴다. 백업은 `<덱 폴더>/temp/deck-review-backup/`에 남는다.
   - 출력 끝의 `feedback file for this version:` 줄이 이 버전 검토자가 저장할 파일명이다. 사용자에게 알려 준다.
3. 슬라이드에 `data-slide-key`가 없으면 스크립트가 `id`로 채운다. 이 키가 피드백의 주소이므로, 슬라이드 순서를 바꾸거나 내용을 고쳐도 키는 유지한다.
4. `python $S/check_deck.py 덱_v1.1.html`로 검수하고, 브라우저로 한 번 열어 피드백 창과 하단 메뉴를 확인한다.

구형(직접 짠) 피드백 뷰어가 들어 있는 덱이면 `apply_shell.py`가 이를 감지해 제거하고 deckId와 피드백 파일명을 이어받는다. 파일명에는 `_{version}`이 자동으로 들어간다(예: `X_feedback.json` → `X_v4.3_feedback.json`).

## 작업 B. 피드백 반영 (주 사용 사례)

사용자가 "v1.1 피드백 반영해줘"라고 하면, 수정 대상은 `덱_v1.1.html`이고 결과는 `덱_v1.2.html`이다. 버전을 말하지 않으면 폴더에서 가장 높은 버전 HTML과 그 버전의 JSON을 찾아 확인받는다.

1. **해당 버전의 작업 목록 만들기**
   ```bash
   python $S/feedback_report.py 덱_v1.1.html                         # 같은 폴더의 덱_v1.1_feedback.json 자동 사용
   python $S/feedback_report.py 덱_v1.1.html A.json B.json           # 같은 버전 검토자 여러 명
   ```
   - 덱 버전과 `deckVersion`이 다른 JSON은 건너뛰고(`note: skip …`), 같은 버전 파일이 하나도 없으면 종료 코드 1로 멈춘다. 이때 다른 버전 파일로 대신 반영하지 말고, 사용자에게 해당 버전 JSON 위치를 묻는다.
   - 같은 버전 파일 여러 개는 슬라이드 키별 최신 의견으로 병합된다. `--json`이면 기계용 출력이 나온다.
2. **다음 버전 파일을 만든다**: `덱_v1.1.html`을 `덱_v1.2.html`로 복사한다. v1.1 파일과 v1.1 JSON은 그대로 보존한다(그 버전 의견의 기준본).
3. 의견마다 v1.2 파일을 수정한다. 영역 정보가 있으면 `영역 선택자`(예: `#s03 > div:nth-of-type(2) > p:nth-of-type(1)`)로 대상 요소를 찾는다. 선택자는 v1.1 기준이므로 복사 직후의 v1.2에서는 그대로 맞는다. 앞선 의견 때문에 구조가 바뀌었으면 `현재 내용` 텍스트로 다시 찾는다.
   - "모든 슬라이드에서"처럼 범위가 넓은 요청은 해당 패턴을 덱 전체에서 찾아 일괄 수정한다.
   - 의견이 모호하면 추측하지 말고 사용자에게 확인한다. 상충하는 의견(검토자 A vs B)도 확인한다.
   - 수정 원칙과 반복 지시 해석은 `references/editing-guide.md`.
4. `<head>` 안 changelog 주석에 `v1.2  (v1.1 피드백 n건 반영) …` 형식으로 변경 사항을 남긴다.
5. 셸을 새 버전으로 갱신한다. 버전·피드백 파일명·저장 공간이 v1.2로 바뀌어 피드백 창이 비어 있는 상태로 시작한다.
   ```bash
   python $S/apply_shell.py 덱_v1.2.html --in-place
   ```
6. `python $S/check_deck.py 덱_v1.2.html` → 문제가 있으면 고친 뒤 다시 돌린다(종료 코드 1 = 문제 있음).
7. 필요하면 `python $S/export_pdf.py 덱_v1.2.html`로 PDF를 만든다.
8. 보고: 반영한 의견(v1.1 기준 슬라이드 번호) / 반영 못 한 의견과 이유 / 검수 결과 / 산출 파일 경로 / 다음 검토자가 저장할 파일명(`덱_v1.2_feedback.json`).

## 작업 C. PDF 출력·검수만

- 화면의 "인쇄 / PDF" 버튼은 먼저 안내 창을 띄운 뒤 브라우저 인쇄 창을 연다. 웹 페이지는 기본 프린터를 바꿀 수 없으므로, 사용자에게 PDF 저장 방법을 알려 줄 때는 **인쇄 창의 대상을 "PDF로 저장"으로 골라야 올바르게 변환된다**(한컴PDF·Microsoft Print to PDF 등은 쪽 크기·여백이 바뀌어 슬라이드가 잘림)는 점을 함께 말한다.

- `python $S/export_pdf.py 덱.html -o 덱_16-9.pdf` → 슬라이드당 1쪽, 텍스트·SVG는 벡터 유지. 화면의 "인쇄 / PDF" 버튼과 같은 결과.
- `python $S/check_deck.py 덱.html [--slides 3,5] [--json]`
  - `outside` = 슬라이드 경계 밖으로 나간 요소(오른쪽 `r+`, 아래 `b+` 픽셀)
  - `clipped` = `overflow:hidden` 박스 안에서 잘린 글자(숨은 픽셀 수)
  - `hidden` = 덱 CSS가 슬라이드를 `display:none`으로 숨김 → 셸이 표시를 담당하므로 해당 규칙을 제거

## 하지 말 것

- 다른 버전의 피드백 JSON을 섞어 반영하지 않는다. JSON의 `deckVersion`을 고쳐서 검증을 통과시키지도 않는다.
- 이미 검토가 끝난 버전 HTML(v1.1)을 수정해 덮어쓰지 않는다. 수정은 항상 다음 버전 파일에서 한다.
- 셸 블록(`<!-- deck-review:begin … -->` ~ `end`) 안을 손으로 고치지 않는다. 설정 변경은 `apply_shell.py` 옵션이나 `--config`로 하고 재실행한다.
- 덱 CSS에서 `.rv-` 접두어 클래스를 쓰거나, 슬라이드 크기·위치를 `transform`으로 직접 조정하지 않는다(셸이 배율을 관리).
- 슬라이드 번호(1, 2, 3…)를 `data-slide-key`로 쓰지 않는다.
