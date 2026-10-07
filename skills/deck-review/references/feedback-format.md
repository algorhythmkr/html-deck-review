# 피드백 JSON 형식과 버전 규칙

## 버전별 파일

| 덱 HTML | 피드백 파일 (기본 이름) | 브라우저 저장 키 |
|---|---|---|
| `my-deck_v1.1.html` | `my-deck_v1.1_feedback.json` | `deck-review.my-deck.v1.1.feedback.v1` |
| `my-deck_v1.2.html` | `my-deck_v1.2_feedback.json` | `deck-review.my-deck.v1.2.feedback.v1` |

- 파일명은 설정 `feedbackFile`의 템플릿(`{deckId}_{version}_feedback.json`)으로 정해진다. `{version}`이 빠진 템플릿은 `apply_shell.py`가 자동으로 넣는다.
- 새 버전 HTML은 다른 저장 키를 쓰므로 피드백 창이 빈 상태로 열린다. 이전 버전 의견은 그 버전 파일에만 남는다.
- 브라우저의 불러오기·저장은 `deckId`와 `deckVersion`이 현재 덱과 같은 파일만 받는다.
- `feedback_report.py`도 같은 규칙을 따른다. 대상 덱과 버전이 다른 파일은 건너뛰고, 행 단위로 `deckVersion`이 다른 의견도 버린다.

## 파일 스키마 (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "deckId": "my-deck",
  "deckVersion": "v1.1",
  "exportedAt": "2026-10-01T05:58:11.636Z",
  "clearedAt": "2026-10-01T05:57:57.610Z",
  "slides": [
    {
      "slideId": "cover",
      "slideNumber": 1,
      "slideTitle": "표지 제목",
      "text": "의견 본문(영역 정보 블록 포함 가능)",
      "updatedAt": "2026-10-01T05:58:11.635Z",
      "deckVersion": "v1.1"
    }
  ]
}
```

| 필드 | 의미 |
|---|---|
| `deckVersion` (파일) | 이 피드백이 속한 덱 버전. 덱과 다르면 불러오기·반영에서 거부 |
| `slideId` | 슬라이드 고정 키(`data-slide-key`). 파일 안에서 중복 불가 |
| `slideNumber`, `slideTitle` | 그 버전에서의 번호·제목 |
| `deckVersion` (행) | 의견을 쓴 버전. 파일 버전과 같아야 한다 |
| `clearedAt` | “전체 삭제” 시각. 이 시각 이전 의견은 병합 때 버려진다 |
| `orphan` | 내보낼 때 덱에 없는 키 |

## 같은 버전 안에서의 병합 규칙 (브라우저와 스크립트가 동일)

1. 입력 전체에서 가장 늦은 `clearedAt`을 구하고, 그 이전 `updatedAt`의 의견은 버린다.
2. 슬라이드 키별로 `updatedAt`이 가장 늦은 의견 하나만 남긴다.
3. 저장 시각은 항상 기존 의견·삭제 시각보다 1ms 이상 늦게 찍어, 시계가 어긋난 PC에서도 새 의견이 이긴다.

같은 버전을 여러 검토자가 봤다면 파일을 함께 넘긴다. 같은 슬라이드에 두 사람이 다른 의견을 썼다면 늦게 쓴 쪽만 남으므로, 검토자별 의견을 모두 보려면 `feedback_report.py`를 파일마다 따로 돌린다.

## 영역 정보 블록

검토자가 슬라이드 요소를 클릭하면 아래 텍스트가 클립보드에 복사되고, 검토자는 이를 피드백 칸에 붙여넣은 뒤 요청을 쓴다. 한 의견에 블록이 여러 개 있을 수 있다.

```
[수정할 영역]
자료 버전: v1.1
슬라이드: 3 / 슬라이드 제목
슬라이드 ID: solution
영역 선택자: #s03 > div:nth-of-type(1) > div:nth-of-type(2) > h3:nth-of-type(1)
종류: 텍스트
현재 내용: 의견 저장
주변 내용: 2 의견 저장 슬라이드 고정 ID별 JSON 파일로 저장 · 서버 전송 없음
원본 위치(1280×720): x=500, y=262, 너비=280, 높이=29
수정 요청: 제목을 ‘JSON 저장’으로 바꿔줘
```

- 영문 덱(`lang: en`)은 `[Region to edit]`, `Selector:`, `Request:` 등 영어 키를 쓴다. `feedback_report.py`는 두 형식을 모두 읽는다.
- 선택자는 그 버전 HTML의 DOM 경로다. 다음 버전 파일을 그 버전에서 복사해 만들면 수정 전까지는 그대로 맞는다.
- 작은 아이콘(SVG 48px 미만)을 누르면 아이콘을 감싼 요소가 선택된다.
