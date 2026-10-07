# 덱 마크업 규약과 설정 항목

## 1. 덱이 지켜야 할 것

| 항목 | 규약 | 이유 |
|---|---|---|
| 슬라이드 요소 | 슬라이드마다 `class="slide"`(기본값, `slideSelector`로 변경 가능) | 셸이 이 요소를 찾아 시트로 감싼다 |
| 크기 | 슬라이드는 고정 픽셀 크기(기본 1280×720) 기준으로 배치 | 셸이 `transform: scale()`로 화면에 맞추고, PDF는 원본 크기 그대로 인쇄 |
| 내부 배치 | 슬라이드 안 요소는 슬라이드 기준 절대·플렉스·그리드 배치 | 셸이 슬라이드에 `position:absolute`를 강제하므로 내부 `absolute` 요소의 기준점이 된다 |
| 표시 | 덱 CSS에서 슬라이드를 `display:none`으로 숨기지 않는다 | 현재 슬라이드 표시는 셸(`.rv-sheet.rv-active`)이 담당 |
| 고정 키 | `data-slide-key="market-size"`처럼 의미 있는 고정 키 | 피드백이 이 키로 저장된다. 없으면 `id`가 키가 된다 |
| 제목 | `data-title` 또는 슬라이드 안 첫 `h1/h2/h3/.ttl/.title` | 패널 제목·이동 목록·내보내기에 쓰인다 |
| 문서 구조 | `</head>`와 `</body>`가 명시돼 있어야 한다 | CSS·JS 블록 삽입 위치 |
| 클릭 제외 | 영역 선택에서 빼고 싶은 요소에 `data-no-pick` | 장식 요소·꼬리말 등 |

슬라이드 바깥의 요소(예: SVG 아이콘 스프라이트를 담은 래퍼)는 그대로 유지된다. 셸은 슬라이드를 새 컨테이너 `#rv-deck`로 옮기고, 비게 된 이전 래퍼는 지우며, 다른 내용이 남은 래퍼는 `display:contents`로 레이아웃에서만 뺀다.

## 2. 셸이 덱에 넣는 것

```html
<head> …
<!-- deck-review:begin css -->
<style id="deck-review-css">…</style>
<!-- deck-review:end css -->
</head>
<body> …슬라이드…
<!-- deck-review:begin js -->
<script type="application/json" id="deck-review-config">{…}</script>
<script type="application/json" id="deck-meta">{…}</script>
<script id="deck-review-js">…</script>
<!-- deck-review:end js -->
</body>
```

- 화면 요소(피드백 창, 하단 메뉴, 삭제 확인 창, 알림)는 JS가 실행 시점에 만든다. HTML 본문에 정적 마크업을 넣지 않는다.
- `deck-meta`는 슬라이드 키·번호·제목·출처 목록이다. `apply_shell.py`가 매번 DOM에서 다시 만들되, 슬라이드별 `sources`는 유지한다.
- 출처를 패널에 띄우려면 `deck-meta`의 해당 슬라이드에 `"sources":[{"title":"통계청 2025","url":"https://…"}]`를 넣고 `apply_shell.py`를 다시 실행한다.

## 3. 설정 항목 (`deck-review-config`)

| 키 | 기본값 | 설명 |
|---|---|---|
| `deckId` | 파일명에서 생성 | 덱 고유 ID. 피드백 JSON 검증·병합 기준. **바꾸지 않는다** |
| `version` | 파일명 `_v1.2` → `v1.2` | 패널 표시, 피드백 파일명·저장 공간 분리 기준. HTML 파일명에 `_v버전`을 넣는다 |
| `title` | `<title>`에서 버전 표기 제거 | 패널 상단 |
| `lang` | `auto` | `auto` / `ko` / `en`: 검토 도구(피드백 창·하단 메뉴·영역 정보) 문구 언어. `auto`는 `<html lang>`을 따르고, 없으면 브라우저 언어를 따른다(한국어 → `ko`, 그 외 → `en`). 덱 본문은 바꾸지 않는다 |
| `langSwitch` | `true` | 하단 메뉴에 `EN` / `한국어` 전환 버튼 표시. 검토자 선택은 브라우저에 덱별로 기억되고 `lang`보다 우선한다. URL `?lang=en`은 둘 다보다 우선한다 |
| `slideSelector` | `.slide` | `.cls`, `tag.cls`, `tag`, `[attr]` 형태 |
| `slideWidth` / `slideHeight` | 1280 / 720 | 슬라이드 원본 크기(px) |
| `feedbackFile` | `{deckId}_{version}_feedback.json` | 저장·내보내기 파일명 템플릿. `{version}`이 없으면 `apply_shell.py`가 넣는다 |
| `storageKey` | `deck-review.{deckId}.{version}.feedback.v1` | 브라우저 저장 키 템플릿. 버전마다 달라서 새 버전은 빈 피드백 창으로 시작 |
| `panelOpen` | `true` | 시작 시 피드백 창 열림 여부. URL에 `?present`를 붙이면 닫힌 채 시작 |
| `regionPick` | `true` | 영역 선택 기본 켜짐 |
| `print.size` | `16:9` | `16:9`(슬라이드 크기 그대로) / `a4`(가로, 여백 맞춤) |
| `print.note` | 자동 | 인쇄 버튼 옆 안내 문구 |
| `pickIgnore` | `[data-no-pick]`, 링크·버튼·입력 | 클릭해도 선택되지 않는 요소 |
| `pickSkipContainers` | `[]` | 그 요소 자체를 클릭하면 무시(예: 본문 래퍼 `.bd`) |
| `pickGroups` | `.card`, `.item`, `.box` | 선택 요소가 속한 묶음의 텍스트를 “주변 내용”으로 첨부 |
| `panelGuide` | 없음 | 패널의 “페이지 구성 안내” 문구 |
| `brand` | `#2350a8` | 버튼·강조 색 |

## 4. 하단 메뉴와 단축키

| 메뉴 | 동작 |
|---|---|
| ← / → | 이전·다음 슬라이드 (키보드 ←→, PageUp/Down, Space, Home/End) |
| 슬라이드 선택 | 번호·제목 목록에서 바로 이동. URL 해시 `#s05`로도 이동 |
| 전체 보기 | 모든 슬라이드를 세로로 나열, 클릭하면 해당 슬라이드로 |
| 전체 화면 | 브라우저 전체 화면 (키 F) |
| 인쇄 / PDF | 인쇄 창을 열고 `@page`를 슬라이드 크기로 설정. “PDF로 저장”을 고르면 여백 없는 벡터 PDF |
| 피드백 열기/닫기 | 오른쪽 패널 토글 (900px 이하 화면에서는 기본 닫힘) |
| Ctrl/⌘+S | 현재 슬라이드 피드백 저장 |

외부에서 제어할 때는 `window.DeckReview.go(n)`, `.index`, `.count`, `.snapshot()`, `.check()`를 쓴다.
