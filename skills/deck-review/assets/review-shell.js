/*! html-deck-review shell v1.4.0 | MIT | (c) 2026 Algorhythm Inc. | jmcho <contact@algorhythm.kr>
 * HTML slide deck viewer: per-slide feedback panel, click-to-quote region picker,
 * bottom toolbar (prev/next, jump, overview, fullscreen, print/PDF).
 * Reads <script type="application/json" id="deck-review-config">.
 */
(() => {
  'use strict';
  const doc = document, root = doc.documentElement;
  const readJSON = id => { const el = doc.getElementById(id); if (!el) return null; try { return JSON.parse(el.textContent); } catch (e) { console.warn('[deck-review] invalid JSON in #' + id, e); return null; } };

  // ---------- config ----------
  const DEFAULTS = {
    deckId: 'deck', version: 'v1', title: '', lang: 'auto', langSwitch: true,
    slideSelector: '.slide', slideWidth: 1280, slideHeight: 720,
    feedbackFile: '', storageKey: '',
    panelOpen: true, regionPick: true, pickInsert: true,
    print: { size: '16:9', note: '' },
    pickIgnore: ['[data-no-pick]', 'a', 'button', 'input', 'select', 'textarea'],
    pickSkipContainers: [],
    pickGroups: ['.card', '.item', '.box'],
    panelGuide: '', brand: ''
  };
  const userCfg = readJSON('deck-review-config') || {};
  const cfg = { ...DEFAULTS, ...userCfg, print: { ...DEFAULTS.print, ...(userCfg.print || {}) } };
  // Feedback is scoped to one deck version: each version gets its own JSON file and browser storage,
  // so opening a new version starts with an empty panel and saving creates a new versioned file.
  const DECK = cfg.deckId, VER = cfg.version || 'v1';
  const fill = t => String(t).replace(/\{deckId\}/g, DECK).replace(/\{version\}/g, VER);
  const KEY = fill(cfg.storageKey || 'deck-review.{deckId}.{version}.feedback.v1'), DRAFTKEY = KEY + '.drafts';
  const FILE = fill(cfg.feedbackFile || '{deckId}_{version}_feedback.json');
  const SW = cfg.slideWidth, SH = cfg.slideHeight;

  const I18N = {
    ko: {
      panel: '슬라이드별 피드백', hint: '슬라이드를 이동해도 작성 내용은 유지됩니다.', label: '이 슬라이드의 피드백',
      placeholder: '수정할 내용이나 추가할 근거를 적어주세요.', save: '저장', revert: '되돌리기',
      importFb: '피드백 불러오기', exportJson: 'JSON 백업', exportText: '텍스트 내보내기', clear: '전체 피드백 삭제',
      regionOn: '영역 선택 켜짐', regionOff: '영역 선택 꺼짐', copyRegion: '선택 영역 복사',
      regionIdle: '슬라이드의 글자·이미지·도표를 클릭하세요.', regionHint: '클릭한 영역의 내용·위치가 피드백 칸에 바로 들어갑니다. ‘수정 요청:’ 뒤에 고칠 내용을 쓰세요. 여러 곳을 차례로 클릭하면 이어서 쌓입니다.',
      regionPicked: n => `${n}페이지 영역을 피드백 칸에 넣었습니다.`, copyRegionAgain: '다시 넣기',
      prev: '이전 슬라이드', next: '다음 슬라이드', jump: '슬라이드 선택', overview: '전체 보기', present: '발표 보기',
      full: '전체 화면', print: '인쇄 / PDF', fbOpen: '피드백 열기', fbClose: '피드백 닫기',
      sources: '이 슬라이드의 자료 출처', guide: '페이지 구성 안내', howto: '저장과 전달 방법',
      howtoBody: f => `<p>피드백은 <b>자료 버전별로</b> 따로 저장됩니다. 이 버전의 피드백 파일은 <b>${f}</b>입니다. 새 버전 자료를 열면 피드백 창은 비어 있고, 저장하면 그 버전 이름의 새 JSON 파일이 만들어집니다.</p><p>Chrome·Edge에서는 첫 저장 때 파일 위치를 고르면 이후 같은 파일을 갱신합니다.</p><p>파일 저장을 지원하지 않는 브라우저에서는 JSON 파일을 내려받습니다. 피드백을 전달할 때는 이 JSON을 함께 보내주세요. 서버로 자동 전송하지 않습니다.</p><p>‘피드백 불러오기’는 같은 버전의 JSON만 받습니다(다른 검토자의 같은 버전 파일 병합용).</p><p>‘인쇄 / PDF’는 브라우저 인쇄 창을 엽니다. 대상을 <b>“PDF로 저장”</b>으로 고르면 여백 없는 벡터 PDF로 저장됩니다. 피드백은 포함하지 않습니다.</p>`,
      firstFb: '이 슬라이드의 첫 피드백을 남겨주세요.', unsaved: '저장하지 않은 변경 사항이 있습니다.', same: '저장한 내용과 같습니다.',
      saved: d => `저장됨 · ${d}`,
      count: n => `피드백 ${n}개 슬라이드`, fileLinked: n => `연결 파일: ${n}`, fileFirst: f => `첫 저장 시 ${f}의 저장 위치를 고르세요.`,
      saving: '파일에 저장하는 중…', savedFile: n => `파일 저장 완료 · ${n}`,
      toastSavedBoth: '피드백을 브라우저와 JSON 파일에 저장했습니다.', toastSavedFileOnly: '피드백을 JSON 파일에 저장했습니다. 브라우저 저장 공간은 쓸 수 없습니다.',
      downloadedLocal: '브라우저 저장 완료 · JSON 파일 다운로드 요청됨', downloadedOnly: 'JSON 파일 다운로드 요청됨 · 브라우저 저장 불가',
      keepJson: f => `내려받은 ${f}을 HTML 폴더에 보관하세요.`,
      savedLocal: '브라우저에 저장됨. ', notSaved: '저장되지 않음. ', aborted: '파일 저장을 취소했습니다.', saveFail: '파일 저장을 완료하지 못했습니다. JSON 백업으로 보관할 수 있습니다.',
      needPerm: '파일 쓰기 권한이 필요합니다.', confirmRevert: '저장하지 않은 변경을 되돌릴까요?',
      exportedJson: '저장된 피드백을 JSON으로 내보냈습니다.', exportedPartial: '저장된 피드백만 내보냈습니다. 작성 중인 내용은 먼저 저장하세요.',
      exportedText: '피드백 TXT 다운로드를 요청했습니다.', textHead: '슬라이드별 피드백', textVer: '자료 버전', textAt: '내보낸 시각', textId: '고정 ID', textUpd: '수정 시각', textEmpty: '(비어 있음)',
      imported: '피드백을 불러와 브라우저에 저장했습니다.', importedNoLocal: '피드백을 불러왔습니다. 브라우저 저장 불가: JSON으로 보관하세요.', merged: '슬라이드 ID별로 최신 피드백을 병합했습니다.',
      linked: '피드백 파일을 연결했습니다. 저장 버튼으로 갱신할 수 있습니다.',
      badFile: '이 발표자료의 피드백 JSON 파일을 선택해 주세요.', badVersion: (f, c) => `이 파일은 ${f} 피드백입니다. 현재 자료(${c})의 피드백 파일만 불러오거나 저장할 수 있습니다.`, badClear: '삭제 시각 형식이 올바르지 않습니다.', badRows: '피드백 파일의 형식을 확인해 주세요.', tooBig: '피드백 파일은 5MB 이하만 불러올 수 있습니다.',
      clearTitle: '모든 피드백을 삭제할까요?', clearDesc: '모든 슬라이드의 피드백과 작성 중인 내용을 삭제합니다. 슬라이드 본문은 유지됩니다.',
      clearLinked: n => `연결 파일 ‘${n}’도 비웁니다. 이 작업은 되돌릴 수 없습니다.`, clearPick: f => `확인 후 비울 ${f}을 선택하세요. 파일 선택을 취소하면 삭제하지 않습니다.`,
      clearNoFs: '이 브라우저는 기존 파일을 직접 수정할 수 없습니다. 확인하면 브라우저의 피드백을 비우고 빈 JSON을 내려받습니다. 내려받은 파일로 기존 JSON을 교체해야 원본 파일에서도 삭제됩니다.',
      cancel: '취소', confirmClear: '확인 · 전체 삭제', clearNoPerm: '파일 쓰기 권한이 없어 삭제하지 않았습니다.',
      clearAborted: '파일 선택을 취소했습니다. 피드백은 삭제되지 않았습니다.', clearFailed: m => `삭제하지 못했습니다. 기존 피드백을 유지합니다. ${m}`,
      clearedFile: '모든 피드백 삭제 완료 · JSON 파일에 반영했습니다.', clearedLocal: '브라우저 피드백 삭제 완료 · 내려받은 빈 JSON으로 기존 파일을 교체하세요.',
      toastClearedBoth: '모든 피드백을 JSON과 브라우저에서 삭제했습니다.', toastClearedFile: 'JSON에서 삭제했습니다. 브라우저 저장이 불가하므로 다시 열 때 이 JSON을 불러오세요.', toastClearedDl: '빈 JSON 다운로드를 요청했습니다. 기존 JSON을 직접 교체해야 파일 삭제도 완료됩니다.',
      copied: '영역 정보를 클립보드에 복사했습니다. 피드백 칸에 붙여넣으세요.', inserted: '영역 내용을 피드백 칸에 넣었습니다. ‘수정 요청:’ 뒤에 이어서 쓰세요.', copyFail: '클립보드 복사에 실패했습니다. ‘선택 영역 복사’를 눌러 다시 시도하세요.',
      printToast: '인쇄 창에서 대상을 “PDF로 저장”으로 고르세요. 여백 없는 벡터 PDF로 저장됩니다.',
      pdfTitle: 'HTML을 PDF 파일로 저장합니다', pdfOpen: '인쇄 창 열기', pdfSkip: '다음부터 이 안내를 보지 않기',
      pdfBody: `<ol><li>다음 인쇄 창에서 <b>대상(프린터)</b>을 <b>“PDF로 저장”</b>으로 고르세요.</li><li><b>저장</b>을 누르면 슬라이드 한 장이 PDF 한 쪽으로, 여백 없이 저장됩니다. 글자와 도표는 벡터로 유지됩니다.</li></ol><p class="rv-warn">한컴PDF·Microsoft Print to PDF 같은 다른 프린터를 고르면 쪽 크기와 여백이 바뀌어 슬라이드가 세로 방향으로 출력되거나, PDF 쪽이 슬라이드 크기와 맞지 않을 수 있습니다. 반드시 <b>“PDF로 저장”</b>을 고르세요.</p><p>웹 페이지는 인쇄 창의 기본 프린터를 바꿀 수 없습니다. Chrome·Edge는 한 번 “PDF로 저장”을 고르면 다음부터 그 선택을 기억합니다.</p>`, noFull: '이 브라우저에서 전체 화면을 지원하지 않습니다.', noStorage: '브라우저 저장 공간을 쓸 수 없습니다. JSON 파일로 피드백을 저장해 주세요.',
      announce: (n, t) => `슬라이드 ${n}: ${t}`, fileDesc: '발표자료 피드백',
      langBtn: 'EN', langTo: 'Switch the review tools to English',
      rgn: { head: '[수정할 영역]', ver: '자료 버전', slide: '슬라이드', id: '슬라이드 ID', sel: '영역 선택자', type: '종류', cur: '현재 내용', ctx: '주변 내용', pos: '원본 위치', w: '너비', h: '높이', ask: '수정 요청', img: '이미지', svg: '도표 요소', box: '텍스트/영역', txt: '텍스트', noAlt: '설명 없는 이미지', none: '내용 없는 영역' }
    },
    en: {
      panel: 'Slide feedback', hint: 'Drafts are kept while you move between slides.', label: 'Feedback for this slide',
      placeholder: 'What should change, or what evidence should be added?', save: 'Save', revert: 'Revert',
      importFb: 'Import feedback', exportJson: 'Backup JSON', exportText: 'Export text', clear: 'Clear all feedback',
      regionOn: 'Region pick: on', regionOff: 'Region pick: off', copyRegion: 'Copy selection',
      regionIdle: 'Click any text, image or chart on the slide.', regionHint: 'Clicking a region drops its content and position straight into the feedback box. Type your request after “Request:”. Click more regions to stack them.',
      regionPicked: n => `Region on slide ${n} added to the feedback box.`, copyRegionAgain: 'Insert again',
      prev: 'Previous slide', next: 'Next slide', jump: 'Jump to slide', overview: 'Overview', present: 'Present',
      full: 'Fullscreen', print: 'Print / PDF', fbOpen: 'Open feedback', fbClose: 'Close feedback',
      sources: 'Sources for this slide', guide: 'About this deck', howto: 'Saving and sharing',
      howtoBody: f => `<p>Feedback is stored <b>per deck version</b>. This version's file is <b>${f}</b>. A new deck version opens with an empty panel, and saving creates a new JSON named for that version.</p><p>In Chrome/Edge, pick where to save on first save; later saves update the same file.</p><p>Other browsers download the JSON instead. Send that JSON to share your feedback; nothing is uploaded to a server.</p><p>“Import feedback” only accepts JSON for this same version (to merge another reviewer's notes).</p><p>“Print / PDF” opens the print dialog. Choose <b>“Save as PDF”</b> for a borderless vector PDF. Feedback is not included.</p>`,
      firstFb: 'Leave the first note for this slide.', unsaved: 'You have unsaved changes.', same: 'Same as saved.',
      saved: d => `Saved · ${d}`,
      count: n => `${n} slide(s) with feedback`, fileLinked: n => `Linked file: ${n}`, fileFirst: f => `On first save, choose where to keep ${f}.`,
      saving: 'Saving to file…', savedFile: n => `Saved to file · ${n}`,
      toastSavedBoth: 'Feedback saved to the browser and the JSON file.', toastSavedFileOnly: 'Feedback saved to the JSON file. Browser storage is unavailable.',
      downloadedLocal: 'Saved in browser · JSON download requested', downloadedOnly: 'JSON download requested · browser storage unavailable',
      keepJson: f => `Keep the downloaded ${f} next to the HTML file.`,
      savedLocal: 'Saved in browser. ', notSaved: 'Not saved. ', aborted: 'File save cancelled.', saveFail: 'Could not write the file. Use “Backup JSON” instead.',
      needPerm: 'Write permission is required.', confirmRevert: 'Discard unsaved changes?',
      exportedJson: 'Saved feedback exported as JSON.', exportedPartial: 'Only saved feedback was exported. Save your draft first.',
      exportedText: 'Text export requested.', textHead: 'Slide feedback', textVer: 'Deck version', textAt: 'Exported at', textId: 'Slide ID', textUpd: 'Updated', textEmpty: '(empty)',
      imported: 'Feedback imported and stored in the browser.', importedNoLocal: 'Feedback imported. Browser storage unavailable: keep the JSON.', merged: 'Merged the newest note per slide ID.',
      linked: 'Feedback file linked. Save updates it.',
      badFile: 'Choose a feedback JSON file for this deck.', badVersion: (f, c) => `This file holds ${f} feedback. Only ${c} feedback can be loaded or saved here.`, badClear: 'Invalid clearedAt timestamp.', badRows: 'Check the feedback file format.', tooBig: 'Feedback files must be 5 MB or smaller.',
      clearTitle: 'Delete all feedback?', clearDesc: 'Deletes feedback and drafts on every slide. Slide content stays untouched.',
      clearLinked: n => `The linked file ‘${n}’ will be emptied too. This cannot be undone.`, clearPick: f => `Next, choose the ${f} to empty. Cancelling the picker deletes nothing.`,
      clearNoFs: 'This browser cannot edit files in place. Confirming empties browser storage and downloads an empty JSON; replace your old JSON with it.',
      cancel: 'Cancel', confirmClear: 'Delete all', clearNoPerm: 'No write permission; nothing deleted.',
      clearAborted: 'File selection cancelled. Nothing was deleted.', clearFailed: m => `Could not delete; feedback kept. ${m}`,
      clearedFile: 'All feedback deleted · JSON file updated.', clearedLocal: 'Browser feedback deleted · replace your old JSON with the downloaded empty one.',
      toastClearedBoth: 'All feedback deleted from the JSON and the browser.', toastClearedFile: 'Deleted from the JSON. Browser storage unavailable; import this JSON next time.', toastClearedDl: 'Empty JSON download requested. Replace the old JSON to finish.',
      copied: 'Region info copied. Paste it into the feedback box.', inserted: 'Region added to the feedback box. Type your request after “Request:”.', copyFail: 'Clipboard copy failed. Try “Copy selection”.',
      printToast: 'In the print dialog choose “Save as PDF” for a borderless vector PDF.',
      pdfTitle: 'Save this HTML deck as a PDF file', pdfOpen: 'Open print dialog', pdfSkip: 'Don’t show this again',
      pdfBody: `<ol><li>In the print dialog that opens next, set <b>Destination (printer)</b> to <b>“Save as PDF”</b>.</li><li>Click <b>Save</b>. Each slide becomes one borderless PDF page, with text and charts kept as vectors.</li></ol><p class="rv-warn">Other printers such as Microsoft Print to PDF or third-party PDF printers change the page size and margins, so slides may come out in portrait orientation or not fit the PDF page. Always choose <b>“Save as PDF”</b>.</p><p>A web page cannot change the print dialog's default printer. Chrome and Edge remember “Save as PDF” once you have chosen it.</p>`, noFull: 'Fullscreen is not supported in this browser.', noStorage: 'Browser storage is unavailable. Save feedback to a JSON file.',
      announce: (n, t) => `Slide ${n}: ${t}`, fileDesc: 'Deck feedback',
      langBtn: '한국어', langTo: '검토 도구를 한국어로 보기',
      rgn: { head: '[Region to edit]', ver: 'Deck version', slide: 'Slide', id: 'Slide ID', sel: 'Selector', type: 'Type', cur: 'Current content', ctx: 'Context', pos: 'Position', w: 'width', h: 'height', ask: 'Request', img: 'image', svg: 'chart element', box: 'text/block', txt: 'text', noAlt: 'image without alt', none: 'empty region' }
    }
  };
  // UI language: ?lang=en|ko in the URL > the viewer's choice from the toolbar switch > cfg.lang.
  // cfg.lang 'auto' follows <html lang> (or the browser language when the deck has none): Korean -> ko, anything else -> en.
  const LANGKEY = 'deck-review.' + DECK + '.lang';
  const pickLang = v => (v = String(v || '').toLowerCase()) && (v.startsWith('ko') ? 'ko' : v.startsWith('en') ? 'en' : '');
  const urlLang = pickLang(new URLSearchParams(location.search).get('lang'));
  let savedLang = ''; try { savedLang = pickLang(localStorage.getItem(LANGKEY)); } catch {}
  const autoLang = () => pickLang(root.getAttribute('lang') || navigator.language) === 'ko' ? 'ko' : 'en';
  const LANG = urlLang || (cfg.langSwitch !== false && savedLang) || (pickLang(cfg.lang) || autoLang());
  cfg.lang = LANG;
  const T = I18N[LANG];
  if (cfg.brand) root.style.setProperty('--rv-brand', cfg.brand);

  // ---------- DOM bootstrap: wrap slides into sheets, build chrome ----------
  const slides = [...doc.querySelectorAll(cfg.slideSelector)].filter(s => !s.closest('.rv-panel,.rv-controls,template'));
  if (!slides.length) { console.warn('[deck-review] no slides match', cfg.slideSelector); return; }
  const h = (tag, attrs = {}, ...kids) => { const el = doc.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null) continue; if (k === 'html') el.innerHTML = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v === true ? '' : v); } el.append(...kids); return el; };
  const legacyParents = new Set();
  const deckEl = h('main', { id: 'rv-deck', 'aria-label': cfg.title || T.panel });
  const sheets = slides.map((s, i) => {
    if (!s.id) s.id = 'rv-slide-' + (i + 1);
    if (!s.dataset.slideKey) s.dataset.slideKey = s.id;
    if (!s.dataset.title) { const t = s.querySelector('h1,h2,h3,.ttl,.title'); s.dataset.title = (t ? t.textContent : s.id).replace(/\s+/g, ' ').trim(); }
    if (s.parentElement && s.parentElement !== doc.body) legacyParents.add(s.parentElement);
    const sheet = h('div', { class: 'rv-sheet' });
    s.before(sheet); sheet.append(s); deckEl.append(sheet);
    return sheet;
  });
  doc.body.prepend(deckEl);
  // remove now-empty legacy wrappers (e.g. an older viewer's <main id="deck"><div class="slide-sheet">)
  // wrappers that still hold other things (e.g. an SVG icon sprite) stay in the DOM but leave the layout
  for (let p of legacyParents) {
    while (p && p !== doc.body && p !== deckEl && !p.children.length && !p.textContent.trim()) { const up = p.parentElement; p.remove(); p = up; }
    if (p && p !== doc.body && p !== deckEl && p.isConnected) p.classList.add('rv-legacy');
  }
  root.style.setProperty('--rv-w', SW + 'px'); root.style.setProperty('--rv-h', SH + 'px');
  root.classList.add('rv-on');

  const metaIn = readJSON('deck-meta') || {};
  const meta = {
    version: VER,
    slides: slides.map((s, i) => { const m = (metaIn.slides || []).find(x => x.id === s.dataset.slideKey) || {}; return { id: s.dataset.slideKey, number: i + 1, title: m.title || s.dataset.title, sources: m.sources || [] }; })
  };

  const btn = (id, text, extra = {}) => h('button', { id, type: 'button', ...extra, text });
  const panel = h('aside', { class: 'rv-panel', id: 'rv-panel', 'aria-label': T.panel },
    h('div', { class: 'rv-kicker' }, h('span', { text: [cfg.title, meta.version].filter(Boolean).join(' · ') }), h('span', { id: 'rv-fbSlide' })),
    h('h1', { id: 'rv-fbTitle' }),
    h('p', { class: 'rv-hint', text: T.hint }),
    h('div', { class: 'rv-region' }, btn('rv-regionMode', T.regionOn, { 'aria-pressed': 'true' }), btn('rv-copyRegion', cfg.pickInsert !== false ? T.copyRegionAgain : T.copyRegion, { hidden: true }), h('p', { id: 'rv-regionStatus', text: T.regionIdle }), h('p', { class: 'rv-region-hint', text: T.regionHint })),
    h('label', { for: 'rv-fbText', text: T.label }),
    h('textarea', { id: 'rv-fbText', maxlength: '100000', placeholder: T.placeholder }),
    h('div', { class: 'rv-save-row' }, btn('rv-save', T.save, { class: 'rv-primary' }), btn('rv-revert', T.revert)),
    h('div', { id: 'rv-saveState', class: 'rv-status', role: 'status', 'aria-live': 'polite' }),
    h('div', { class: 'rv-actions' }, btn('rv-import', T.importFb), btn('rv-exportJson', T.exportJson), btn('rv-exportText', T.exportText), btn('rv-clear', T.clear, { class: 'rv-danger' }), h('span', { id: 'rv-count', class: 'rv-count' })),
    h('input', { type: 'file', id: 'rv-importFile', accept: '.json,application/json', hidden: true }),
    h('div', { class: 'rv-list', id: 'rv-list' }),
    h('div', { id: 'rv-fileState', class: 'rv-file' }),
    h('details', { id: 'rv-sourceDetails', hidden: true }, h('summary', { text: T.sources }), h('div', { id: 'rv-sourceLinks' })),
    ...(cfg.panelGuide ? [h('details', {}, h('summary', { text: T.guide }), h('p', { text: cfg.panelGuide }))] : []),
    h('details', {}, h('summary', { text: T.howto }), h('div', { html: T.howtoBody(FILE) }))
  );
  const printNote = cfg.print.note || (cfg.print.size === 'a4' ? 'A4' : '16:9') + (LANG === 'en' ? ' · no margins' : ' · 여백 없음');
  const controls = h('nav', { class: 'rv-controls', id: 'rv-controls', 'aria-label': 'deck controls' },
    btn('rv-prev', '←', { 'aria-label': T.prev }), h('span', { id: 'rv-counter' }), btn('rv-next', '→', { 'aria-label': T.next }),
    h('select', { id: 'rv-jump', 'aria-label': T.jump }), btn('rv-overview', T.overview, { 'aria-pressed': 'false' }), btn('rv-full', T.full, { title: 'F' }),
    h('span', { class: 'rv-sep', 'aria-hidden': 'true' }),
    btn('rv-print', T.print, { class: 'rv-primary' }), h('span', { class: 'rv-print-note', text: printNote }),
    btn('rv-fbToggle', T.fbClose, { 'aria-pressed': 'true', 'aria-controls': 'rv-panel' }),
    ...(cfg.langSwitch !== false ? [btn('rv-lang', T.langBtn, { title: T.langTo, 'aria-label': T.langTo, lang: LANG === 'ko' ? 'en' : 'ko' })] : [])
  );
  const dialog = h('dialog', { id: 'rv-clearDialog', class: 'rv-dialog', 'aria-labelledby': 'rv-clearTitle' },
    h('h2', { id: 'rv-clearTitle', text: T.clearTitle }), h('p', { id: 'rv-clearDesc' }), h('p', { id: 'rv-clearNote' }), h('p', { id: 'rv-clearError', role: 'alert' }),
    h('div', { class: 'rv-dialog-actions' }, btn('rv-cancelClear', T.cancel), btn('rv-confirmClear', T.confirmClear, { class: 'rv-danger rv-primary' })));
  const pdfDialog = h('dialog', { id: 'rv-printDialog', class: 'rv-dialog', 'aria-labelledby': 'rv-printTitle' },
    h('h2', { id: 'rv-printTitle', text: T.pdfTitle }), h('div', { html: T.pdfBody }),
    h('label', { class: 'rv-check' }, h('input', { type: 'checkbox', id: 'rv-printSkip' }), doc.createTextNode(' ' + T.pdfSkip)),
    h('div', { class: 'rv-dialog-actions' }, btn('rv-cancelPrint', T.cancel), btn('rv-openPrint', T.pdfOpen, { class: 'rv-primary' })));
  doc.body.append(panel, controls, dialog, pdfDialog, h('div', { class: 'rv-sr', id: 'rv-announce', 'aria-live': 'polite' }), h('div', { class: 'rv-toast', id: 'rv-toast', role: 'status', 'aria-live': 'polite' }));
  let pageRule = doc.getElementById('rv-pagerule'); if (!pageRule) { pageRule = h('style', { id: 'rv-pagerule' }); doc.head.append(pageRule); }

  // ---------- state ----------
  const $ = id => doc.getElementById('rv-' + id);
  let index = 0, handle = null, busy = false, toastTimer, storageAvailable = true, unpersisted = false;
  const empty = () => ({ schemaVersion: 1, deckId: DECK, deckVersion: meta.version, exportedAt: null, slides: [] });
  function validate(v) {
    if (!v || v.schemaVersion !== 1 || v.deckId !== DECK || !Array.isArray(v.slides)) throw Error(T.badFile);
    if (v.deckVersion !== VER) throw Error(T.badVersion(v.deckVersion || '?', VER));
    if (v.clearedAt !== undefined && v.clearedAt !== null && !Number.isFinite(Date.parse(v.clearedAt))) throw Error(T.badClear);
    const keys = new Set();
    for (const r of v.slides) { if (!r || typeof r.slideId !== 'string' || !r.slideId || keys.has(r.slideId) || typeof r.text !== 'string' || (r.deckVersion !== undefined && r.deckVersion !== VER) || r.text.length > 100000 || !Number.isFinite(Date.parse(r.updatedAt))) throw Error(T.badRows); keys.add(r.slideId); }
    return v;
  }
  function merge(a, b) {
    const cleared = Math.max(Date.parse(a.clearedAt || '') || 0, Date.parse(b.clearedAt || '') || 0), rows = new Map();
    for (const r of [...a.slides, ...b.slides]) { if (Date.parse(r.updatedAt) <= cleared) continue; const old = rows.get(r.slideId); if (!old || Date.parse(r.updatedAt) > Date.parse(old.updatedAt)) rows.set(r.slideId, r); }
    return { ...empty(), ...(cleared ? { clearedAt: new Date(cleared).toISOString() } : {}), slides: [...rows.values()] };
  }
  let state = empty(), drafts = {};
  try { const saved = localStorage.getItem(KEY); if (saved) state = merge(state, validate(JSON.parse(saved))); } catch { storageAvailable = false; }
  try { const v = JSON.parse(sessionStorage.getItem(DRAFTKEY) || '{}'); if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'string') drafts[k] = x; } catch {}
  try { if ((Date.parse(state.clearedAt || '') || 0) > (Date.parse(sessionStorage.getItem(DRAFTKEY + '.clearedAt') || '') || 0)) { drafts = {}; sessionStorage.setItem(DRAFTKEY, '{}'); sessionStorage.setItem(DRAFTKEY + '.clearedAt', state.clearedAt); } } catch {}

  const key = () => slides[index].dataset.slideKey;
  const entry = k => state.slides.find(r => r.slideId === k);
  const dirty = k => Object.hasOwn(drafts, k) && drafts[k] !== (entry(k)?.text || '');
  const allDirty = () => Object.keys(drafts).some(dirty);
  const pad = n => String(n).padStart(2, '0');
  const stamp = id => new Date(Math.max(Date.now(), (Date.parse(entry(id)?.updatedAt || '') || 0) + 1, (Date.parse(state.clearedAt || '') || 0) + 1)).toISOString();
  function toast(s) { $('toast').textContent = s; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').textContent = '', 6000); }
  function persist() { try { const other = localStorage.getItem(KEY); if (other) state = merge(state, validate(JSON.parse(other))); localStorage.setItem(KEY, JSON.stringify(state)); storageAvailable = true; return true; } catch { storageAvailable = false; return false; } }
  function persistDrafts() { try { sessionStorage.setItem(DRAFTKEY, JSON.stringify(drafts)); sessionStorage.setItem(DRAFTKEY + '.clearedAt', state.clearedAt || ''); } catch {} }
  function snapshot() {
    return { ...state, deckVersion: meta.version, exportedAt: new Date().toISOString(),
      slides: state.slides.map(r => { const m = meta.slides.find(s => s.id === r.slideId); return { ...r, ...(m ? { slideNumber: m.number, slideTitle: m.title } : { slideNumber: null, orphan: true }) }; })
        .sort((a, b) => (a.slideNumber || 999) - (b.slideNumber || 999)) };
  }
  function download(content, name, type) { const u = URL.createObjectURL(new Blob([content], { type })); const a = h('a', { href: u, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000); }
  const jsonBackup = () => download(JSON.stringify(snapshot(), null, 2), FILE, 'application/json;charset=utf-8');
  const pickerTypes = [{ description: T.fileDesc, accept: { 'application/json': ['.json'] } }];

  // ---------- rendering ----------
  function refreshList() {
    const written = state.slides.filter(r => r.text.trim() && meta.slides.some(m => m.id === r.slideId));
    $('count').textContent = T.count(written.length);
    const list = $('list'); list.replaceChildren();
    for (const r of written) { const n = meta.slides.findIndex(s => s.id === r.slideId); const b = h('button', { type: 'button', title: meta.slides[n].title, text: pad(n + 1) }); b.onclick = () => go(n); list.append(b); }
  }
  function renderPanel(message) {
    const refs = meta.slides[index].sources || [];
    $('sourceDetails').hidden = !refs.length; $('sourceLinks').replaceChildren(...refs.map(r => h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', text: r.title || r.url })));
    $('fbSlide').textContent = `${pad(index + 1)} / ${slides.length}`;
    $('fbTitle').textContent = meta.slides[index].title;
    $('fbText').value = Object.hasOwn(drafts, key()) ? drafts[key()] : (entry(key())?.text || '');
    const r = entry(key());
    $('saveState').textContent = message || (dirty(key()) ? T.unsaved : r ? T.saved(new Date(r.updatedAt).toLocaleString(LANG === 'en' ? 'en-US' : 'ko-KR')) : T.firstFb);
    $('fileState').textContent = handle ? T.fileLinked(handle.name) : T.fileFirst(FILE);
    refreshList();
  }
  function fit() {
    const tb = $('controls').getBoundingClientRect().height; root.style.setProperty('--rv-toolbar', tb + 'px');
    const area = deckEl, mobile = innerWidth <= 900, w = area.clientWidth - 40, hh = innerHeight - tb - 42;
    const scale = Math.max(.12, Math.min(1.6, w / SW, (mobile || root.classList.contains('rv-overview')) ? 9 : hh / SH));
    root.style.setProperty('--rv-scale', String(scale));
  }
  function go(i, hash = true) {
    clearSelection();
    index = Math.max(0, Math.min(slides.length - 1, Number(i) || 0));
    const overview = root.classList.contains('rv-overview');
    slides.forEach((s, j) => { sheets[j].classList.toggle('rv-active', j === index); s.setAttribute('aria-hidden', String(!overview && j !== index)); });
    $('jump').value = String(index); $('prev').disabled = index === 0; $('next').disabled = index === slides.length - 1;
    $('counter').textContent = `${index + 1} / ${slides.length}`;
    if (hash) history.replaceState(null, '', '#' + slides[index].id);
    $('announce').textContent = T.announce(index + 1, meta.slides[index].title);
    renderPanel();
    if (overview) sheets[index].scrollIntoView({ block: 'nearest' });
  }
  for (const [i, s] of slides.entries()) {
    $('jump').append(h('option', { value: String(i), text: `${pad(i + 1)} · ${meta.slides[i].title}` }));
    sheets[i].addEventListener('click', e => { if (root.classList.contains('rv-overview') && !e.target.closest('a')) { root.classList.remove('rv-overview'); $('overview').textContent = T.overview; $('overview').setAttribute('aria-pressed', 'false'); fit(); go(i); } });
  }
  const fromHash = () => { const i = slides.findIndex(s => '#' + s.id === location.hash); if (i >= 0) go(i, false); };

  // ---------- toolbar ----------
  $('prev').onclick = () => go(index - 1); $('next').onclick = () => go(index + 1); $('jump').onchange = e => go(e.target.value);
  $('overview').onclick = () => { const on = root.classList.toggle('rv-overview'); $('overview').textContent = on ? T.present : T.overview; $('overview').setAttribute('aria-pressed', on); fit(); go(index, false); };
  function setPanel(open) { root.classList.toggle('rv-fb-hidden', !open); $('fbToggle').setAttribute('aria-pressed', String(open)); $('fbToggle').textContent = open ? T.fbClose : T.fbOpen; fit(); }
  $('fbToggle').onclick = () => setPanel(root.classList.contains('rv-fb-hidden'));

  // Print geometry: 16:9 page = slide px at 96dpi; A4 landscape letterboxes the slide.
  function printMode() {
    const mm = px => px * 25.4 / 96, a4 = cfg.print.size === 'a4';
    const pw = a4 ? 297 : mm(SW), ph = a4 ? 210 : mm(SH), sc = a4 ? Math.min(297 / mm(SW), 210 / mm(SH)) : 1;
    const top = a4 ? (210 - mm(SH) * sc) / 2 : 0, left = a4 ? (297 - mm(SW) * sc) / 2 : 0;
    root.style.setProperty('--rv-print-w', pw + 'mm'); root.style.setProperty('--rv-print-h', ph + 'mm');
    root.style.setProperty('--rv-print-scale', String(sc)); root.style.setProperty('--rv-print-top', top + 'mm'); root.style.setProperty('--rv-print-left', left + 'mm');
    pageRule.textContent = `@page{size:${pw}mm ${ph}mm;margin:0}`;
  }
  // A page cannot pick the print destination, so explain "Save as PDF" before the browser's print dialog opens.
  const PRINTSKIP = 'deck-review.printGuide.hidden';
  const openPrint = () => { const b = $('print'); b.disabled = true; toast(T.printToast); printMode(); setTimeout(() => window.print(), 300); setTimeout(() => { b.disabled = false; }, 3000); };
  $('print').onclick = () => { let skip = false; try { skip = localStorage.getItem(PRINTSKIP) === '1'; } catch {} if (skip) openPrint(); else { $('printSkip').checked = false; $('printDialog').showModal(); $('openPrint').focus(); } };
  $('cancelPrint').onclick = () => $('printDialog').close();
  $('openPrint').onclick = () => { if ($('printSkip').checked) { try { localStorage.setItem(PRINTSKIP, '1'); } catch {} } $('printDialog').close(); openPrint(); };
  addEventListener('beforeprint', printMode);
  async function full() { try { if (doc.fullscreenElement) await doc.exitFullscreen(); else await root.requestFullscreen(); } catch { toast(T.noFull); } }
  $('full').onclick = full;

  // ---------- feedback save / import / export ----------
  $('fbText').oninput = e => { drafts[key()] = e.target.value; persistDrafts(); $('saveState').textContent = dirty(key()) ? T.unsaved : T.same; };
  function idb(mode, fn) { try { const req = indexedDB.open(KEY, 1); req.onupgradeneeded = () => req.result.createObjectStore('files'); req.onsuccess = () => { const db = req.result; try { const tx = db.transaction('files', mode); fn(tx.objectStore('files')); tx.oncomplete = tx.onerror = () => db.close(); } catch { db.close(); } }; } catch {} }
  const rememberHandle = hd => idb('readwrite', s => s.put(hd, 'feedback'));
  const restoreHandle = () => idb('readonly', s => { const q = s.get('feedback'); q.onsuccess = () => { handle = q.result || null; renderPanel(); }; });
  async function readHandle(hd) { const f = await hd.getFile(); if (!f.size) return empty(); if (f.size > 5e6) throw Error(T.tooBig); return validate(JSON.parse(await f.text())); }
  async function ensurePerm(hd, msg) { if (await hd.queryPermission({ mode: 'readwrite' }) !== 'granted' && await hd.requestPermission({ mode: 'readwrite' }) !== 'granted') throw Error(msg); }

  async function saveFeedback() {
    if (busy) return;
    const id = key(), txt = $('fbText').value, m = meta.slides[index];
    try { const latest = localStorage.getItem(KEY); if (latest) state = merge(state, validate(JSON.parse(latest))); } catch {}
    const record = { slideId: id, slideNumber: index + 1, slideTitle: m.title, text: txt, updatedAt: stamp(id), deckVersion: meta.version };
    state = merge(state, { ...empty(), slides: [record] });
    const localOK = persist(); unpersisted = !localOK; delete drafts[id]; persistDrafts();
    busy = true; $('save').disabled = true; renderPanel(T.saving);
    try {
      if (typeof window.showSaveFilePicker === 'function') {
        const cand = handle || await showSaveFilePicker({ suggestedName: FILE, types: pickerTypes });
        await ensurePerm(cand, T.needPerm);
        state = merge(state, await readHandle(cand)); handle = cand;
        record.updatedAt = stamp(id); state = merge(state, { ...empty(), slides: [record] }); persist();
        const st = await handle.createWritable(); await st.write(JSON.stringify(snapshot(), null, 2)); await st.close();
        unpersisted = false; rememberHandle(handle); renderPanel(T.savedFile(handle.name)); toast(storageAvailable ? T.toastSavedBoth : T.toastSavedFileOnly);
      } else { jsonBackup(); unpersisted = false; renderPanel(localOK ? T.downloadedLocal : T.downloadedOnly); toast(T.keepJson(FILE)); }
    } catch (e) {
      if (!localOK) { drafts[id] = txt; persistDrafts(); }
      renderPanel((localOK ? T.savedLocal : T.notSaved) + (e.name === 'AbortError' ? T.aborted : e.message));
      if (e.name !== 'AbortError') toast(T.saveFail);
    } finally { busy = false; $('save').disabled = false; }
  }
  $('save').onclick = saveFeedback;
  $('revert').onclick = () => { if (!dirty(key()) || confirm(T.confirmRevert)) { delete drafts[key()]; persistDrafts(); renderPanel(); } };
  $('exportJson').onclick = () => { jsonBackup(); toast(allDirty() ? T.exportedPartial : T.exportedJson); };
  $('exportText').onclick = () => {
    const v = snapshot(); let t = `${cfg.title ? cfg.title + ' · ' : ''}${T.textHead}\n${T.textVer}: ${v.deckVersion}\n${T.textAt}: ${v.exportedAt}\n\n`;
    for (const r of v.slides) t += `[${r.slideNumber || '?'}] ${r.slideTitle || r.slideId}\n${T.textId}: ${r.slideId}\n${T.textUpd}: ${r.updatedAt}\n${r.text || T.textEmpty}\n\n${'-'.repeat(55)}\n\n`;
    download('﻿' + t, FILE.replace(/\.json$/i, '') + '.txt', 'text/plain;charset=utf-8'); toast(allDirty() ? T.exportedPartial : T.exportedText);
  };
  async function importData(v) {
    const prior = Date.parse(state.clearedAt || '') || 0; state = merge(state, validate(v));
    if ((Date.parse(state.clearedAt || '') || 0) > prior) { drafts = {}; persistDrafts(); clearSelection(); }
    renderPanel(persist() ? T.imported : T.importedNoLocal); toast(T.merged);
  }
  $('import').onclick = async () => {
    if (busy) return;
    try {
      if (typeof window.showOpenFilePicker === 'function') { const [hd] = await showOpenFilePicker({ multiple: false, types: pickerTypes }); await importData(await readHandle(hd)); handle = hd; rememberHandle(handle); renderPanel(T.linked); }
      else $('importFile').click();
    } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
  };
  $('importFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { if (f.size > 5e6) throw Error(T.tooBig); await importData(JSON.parse(await f.text())); } catch (er) { toast(er.message); } finally { $('importFile').value = ''; } };

  // Clear all: keep a clearedAt watermark so older copies of this version's JSON cannot resurrect deleted notes on merge.
  const clearDialog = $('clearDialog'); let clearing = false, selectedRegion = null, areaMode = !!cfg.regionPick;
  const lockIds = ['save', 'clear', 'import', 'exportJson', 'exportText', 'revert', 'fbText', 'regionMode', 'copyRegion', 'confirmClear', 'cancelClear'];
  function setClearBusy(on) { clearing = on; busy = on; for (const id of lockIds) $(id).disabled = on; }
  function watermark(...vals) { let t = Date.now(); for (const v of vals) { t = Math.max(t, Date.parse(v?.clearedAt || '') || 0); for (const r of v?.slides || []) t = Math.max(t, Date.parse(r.updatedAt) || 0); } return new Date(t + 1).toISOString(); }
  $('clear').onclick = () => {
    if (busy) return;
    const direct = !!handle || typeof window.showOpenFilePicker === 'function';
    $('clearDesc').textContent = T.clearDesc;
    $('clearNote').textContent = direct ? (handle ? T.clearLinked(handle.name) : T.clearPick(FILE)) : T.clearNoFs;
    $('clearError').textContent = ''; clearDialog.showModal(); $('cancelClear').focus();
  };
  $('cancelClear').onclick = () => clearDialog.close();
  clearDialog.addEventListener('cancel', e => { if (clearing) e.preventDefault(); });
  $('confirmClear').onclick = async () => {
    if (clearing || busy) return; setClearBusy(true); $('clearError').textContent = ''; let cand = handle, stream = null;
    try {
      let remote = empty(), other = empty();
      if (!cand && typeof window.showOpenFilePicker === 'function') [cand] = await showOpenFilePicker({ multiple: false, types: pickerTypes });
      if (cand) { await ensurePerm(cand, T.clearNoPerm); remote = await readHandle(cand); }
      try { const v = localStorage.getItem(KEY); if (v) other = validate(JSON.parse(v)); } catch {}
      const cleared = { ...empty(), clearedAt: watermark(state, remote, other), exportedAt: new Date().toISOString(), slides: [] };
      if (cand) { stream = await cand.createWritable(); await stream.write(JSON.stringify(cleared, null, 2)); await stream.close(); stream = null; }
      // Only wipe screen/browser state after the file write succeeded.
      state = cleared; drafts = {}; persistDrafts(); const localOK = persist(); unpersisted = !localOK && !cand;
      if (cand) { handle = cand; rememberHandle(handle); } else jsonBackup();
      clearSelection(); clearDialog.close();
      renderPanel(cand ? T.clearedFile : T.clearedLocal);
      toast(cand ? (localOK ? T.toastClearedBoth : T.toastClearedFile) : T.toastClearedDl);
    } catch (e) {
      if (stream) try { await stream.abort(); } catch {}
      $('clearError').textContent = e.name === 'AbortError' ? T.clearAborted : T.clearFailed(e.message);
    } finally { setClearBusy(false); (clearDialog.open ? $('cancelClear') : $('clear')).focus(); }
  };

  // ---------- region picker: stable DOM path + original-coordinate box ----------
  function clearSelection() { doc.querySelectorAll('.rv-picked').forEach(e => e.classList.remove('rv-picked')); selectedRegion = null; if ($('copyRegion')) { $('copyRegion').hidden = true; $('regionStatus').textContent = T.regionIdle; } }
  function selectorOf(el, slide) {
    const parts = []; let cur = el;
    while (cur && cur !== slide) { const name = cur.localName, sib = [...cur.parentElement.children].filter(e => e.localName === name); parts.unshift(`${name}:nth-of-type(${sib.indexOf(cur) + 1})`); cur = cur.parentElement; }
    return '#' + slide.id + (parts.length ? ' > ' + parts.join(' > ') : '');
  }
  const ignoreSel = cfg.pickIgnore.join(','), skipSel = cfg.pickSkipContainers.join(','), groupSel = cfg.pickGroups.join(',');
  function targetRegion(raw, slide) {
    let el = raw instanceof Element ? raw : raw.parentElement;
    if (!el || el === slide || (ignoreSel && el.closest(ignoreSel))) return null;
    if (el instanceof SVGElement) { const svg = el.closest('svg'); if (!svg) return null; const small = svg.getBoundingClientRect().width < 48; if (small) el = svg.parentElement; else if (el === svg || el.localName === 'use') el = svg; }
    if (skipSel && el.matches(skipSel)) return null;
    return slide.contains(el) && el !== slide ? el : null;
  }
  function describeRegion(el, slide, i) {
    const R = T.rgn, box = el.getBoundingClientRect(), cv = slide.getBoundingClientRect(), n = Math.round;
    const pos = { x: n((box.left - cv.left) * SW / cv.width), y: n((box.top - cv.top) * SH / cv.height), w: n(box.width * SW / cv.width), h: n(box.height * SH / cv.height) };
    const type = el.tagName === 'IMG' ? R.img : el instanceof SVGElement ? R.svg : el.children.length ? R.box : R.txt;
    // innerText keeps <br> and block breaks as spaces, so "line<br>break" does not collapse into "linebreak".
    let content = el.tagName === 'IMG' ? el.getAttribute('alt') || R.noAlt : ((el instanceof HTMLElement ? el.innerText : '') || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!content && el instanceof SVGElement) { const at = ['x', 'y', 'width', 'height', 'fill', 'stroke'].filter(a => el.hasAttribute(a)).map(a => `${a}=${el.getAttribute(a)}`).join(', '); content = `${el.localName}${at ? ' (' + at + ')' : ''}`; }
    content = content.slice(0, 600) || R.none;
    const group = groupSel ? el.closest(groupSel) : null, ctx = group && group !== el && slide.contains(group) ? (group.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220) : '';
    const sel = selectorOf(el, slide);
    return { slideId: slide.dataset.slideKey, selector: sel, text: `${R.head}\n${R.ver}: ${meta.version}\n${R.slide}: ${i + 1} / ${meta.slides[i].title}\n${R.id}: ${slide.dataset.slideKey}\n${R.sel}: ${sel}\n${R.type}: ${type}\n${R.cur}: ${content}${ctx ? `\n${R.ctx}: ${ctx}` : ''}\n${R.pos}(${SW}×${SH}): x=${pos.x}, y=${pos.y}, ${R.w}=${pos.w}, ${R.h}=${pos.h}\n${R.ask}: ` };
  }
  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    const active = doc.activeElement, a = h('textarea', { style: 'position:fixed;left:-10000px;top:0' }); a.value = text; doc.body.append(a); a.select(); let ok = false; try { ok = doc.execCommand('copy'); } catch {} a.remove(); active?.focus(); return ok;
  }
  // Click-to-quote: append the region block to this slide's draft and leave the caret after the request label.
  function insertRegion(text) {
    const ta = $('fbText'), cur = ta.value, sep = !cur ? '' : cur.endsWith('\n\n') ? '' : cur.endsWith('\n') ? '\n' : '\n\n';
    ta.value = cur + sep + text; drafts[key()] = ta.value; persistDrafts();
    $('saveState').textContent = dirty(key()) ? T.unsaved : T.same;
    ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollTop = ta.scrollHeight;
  }
  const useRegion = async info => { if (cfg.pickInsert !== false) { insertRegion(info.text); toast(T.inserted); } else toast(await copyText(info.text) ? T.copied : T.copyFail); };
  function setAreaMode(on) { areaMode = on; root.classList.toggle('rv-area', on); $('regionMode').setAttribute('aria-pressed', String(on)); $('regionMode').textContent = on ? T.regionOn : T.regionOff; if (!on) clearSelection(); }
  $('regionMode').onclick = () => setAreaMode(!areaMode);
  $('copyRegion').onclick = () => { if (selectedRegion) useRegion(selectedRegion); };
  slides.forEach((slide, i) => slide.addEventListener('click', async e => {
    if (!areaMode || busy || clearDialog.open || $('printDialog').open || root.classList.contains('rv-fb-hidden') || root.classList.contains('rv-overview')) return;
    const el = targetRegion(e.target, slide); if (!el) return;
    e.preventDefault(); e.stopPropagation(); if (index !== i) go(i);
    const info = describeRegion(el, slide, i);
    clearSelection(); el.classList.add('rv-picked'); selectedRegion = info;
    $('regionStatus').textContent = cfg.pickInsert !== false ? T.regionPicked(i + 1) : T.regionIdle; $('copyRegion').hidden = false;
    await useRegion(info);
  }));

  // ---------- keyboard & lifecycle ----------
  doc.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if ($('printDialog').open) return;
    if (clearDialog.open) { if (mod && e.key.toLowerCase() === 's') e.preventDefault(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveFeedback(); return; }
    const a = doc.activeElement; if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(a.tagName) || a.isContentEditable || mod || e.altKey) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(index + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
    else if (e.key.toLowerCase() === 'f') full();
    else if (e.key === 'Escape' && selectedRegion) clearSelection();
  });
  // language switch: rebuild the UI by reloading; unsaved drafts survive in sessionStorage
  let switchingLang = false;
  if ($('lang')) $('lang').onclick = () => {
    if (busy || unpersisted) return;
    const next = LANG === 'ko' ? 'en' : 'ko';
    try { localStorage.setItem(LANGKEY, next); } catch {}
    persistDrafts(); switchingLang = true;
    const u = new URL(location.href);
    if (u.searchParams.has('lang') || localStorageBlocked()) { u.searchParams.set('lang', next); location.replace(u.href); } else location.reload();
  };
  function localStorageBlocked() { try { return localStorage.getItem(LANGKEY) === null; } catch { return true; } }
  addEventListener('beforeunload', e => { if (switchingLang && !busy && !unpersisted) return; if (allDirty() || busy || unpersisted) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('hashchange', fromHash); addEventListener('resize', fit); addEventListener('fullscreenchange', fit);
  addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { const prior = Date.parse(state.clearedAt || '') || 0; state = merge(state, validate(JSON.parse(e.newValue))); if ((Date.parse(state.clearedAt || '') || 0) > prior) { drafts = {}; persistDrafts(); clearSelection(); } renderPanel(); } catch {} } });
  new ResizeObserver(fit).observe($('controls'));

  // ---------- layout check (used by scripts/check_deck.py via ?rv-check) ----------
  function check() {
    root.classList.add('rv-overview'); root.style.setProperty('--rv-scale', '1');
    const out = [];
    slides.forEach((slide, i) => {
      const issues = [], cv = slide.getBoundingClientRect();
      if (getComputedStyle(slide).display === 'none') issues.push({ kind: 'hidden', note: 'slide is display:none (deck CSS hides it)' });
      for (const el of slide.querySelectorAll('*')) {
        if (el.closest('svg') && el.localName !== 'svg') continue;
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const over = { r: Math.round(r.right - cv.right), b: Math.round(r.bottom - cv.bottom), l: Math.round(cv.left - r.left), t: Math.round(cv.top - r.top) };
        if (Math.max(over.r, over.b, over.l, over.t) > 2 && el.parentElement && el.parentElement.getBoundingClientRect().right <= cv.right + 2 && el.parentElement.getBoundingClientRect().bottom <= cv.bottom + 2)
          issues.push({ kind: 'outside', selector: selectorOf(el, slide), over, text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) });
        if (/(hidden|clip|auto|scroll)/.test(cs.overflow + cs.overflowY) && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0)
          issues.push({ kind: 'clipped', selector: selectorOf(el, slide), hidden: el.scrollHeight - el.clientHeight, text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) });
      }
      out.push({ number: i + 1, slideId: slide.dataset.slideKey, title: meta.slides[i].title, issues: issues.slice(0, 30) });
    });
    return { deckId: DECK, version: meta.version, slideCount: slides.length, slides: out };
  }

  if (/[?&]rv-check\b/.test(location.search)) {
    const run = () => { const res = h('script', { type: 'application/json', id: 'rv-check-result' }); res.textContent = JSON.stringify(check()); doc.body.append(res); };
    (doc.fonts?.ready || Promise.resolve()).then(() => setTimeout(run, 200));
  }

  printMode(); setAreaMode(areaMode);
  setPanel(cfg.panelOpen && innerWidth > 900 && !/[?&]present\b/.test(location.search));
  go(0, false); fromHash(); restoreHandle(); doc.fonts?.ready.then(fit);
  if (!storageAvailable) toast(T.noStorage);
  window.DeckReview = { go, get index() { return index; }, count: slides.length, config: cfg, snapshot, printMode, check };
})();
