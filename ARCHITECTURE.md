# Архитектура «Запоминалки» — карта для правки кода

Справочник для того, кто открывает проект без истории переписки: где что лежит, как данные текут от касания до диска и экрана, кто от кого зависит. Здесь описано, **как устроено**. Где ошибались раньше и что нельзя ломать, собрано в [CLAUDE.md](CLAUDE.md). Что умеет приложение с точки зрения пользователя, описано в [README.md](README.md).

Номера строк ниже приблизительные: файл правится постоянно, и они сдвигаются. Ищите по имени — `grep -n "function имя(" index.html`. Свежую карту всех функций с номерами строк даёт команда из раздела [«Как быстро сориентироваться»](#как-быстро-сориентироваться).

Сверено с кодом 2026-10-30: версия кэша `zapominalka-v141`, `index.html` — около 21 000 строк, 1 МБ (по сети — около 195 КБ: GitHub Pages отдаёт его сжатым gzip).

---

## 1. Общая картина

```
 GitHub (Psycho02-debug/Knowledge, ветка main)
        │  git push → GitHub Pages за 1–2 минуты
        ▼
 https://psycho02-debug.github.io/Knowledge/
        │  первый визит: sw.js кладёт файлы в Cache Storage
        ▼
 ┌──────────────── iPhone (Safari, ярлык на домашнем экране) ────────────────┐
 │  sw.js — «сначала кэш»: index.html, fonts.css, fonts/*.woff2, иконки       │
 │     │                                                                      │
 │     ▼                                                                      │
 │  index.html ── <style> 6 тыс. строк ── статичная разметка окон ──          │
 │     <script> 11 тыс. строк:                                               │
 │                                                                            │
 │   касание / клавиша                                                        │
 │        │ onclick="fn()" в разметке, или один из глобальных слушателей      │
 │        ▼                                                                   │
 │   обработчик действия ──► меняет state и данные материала                  │
 │        │                      │                                            │
 │        │                      └──► saveData() ─ таймер 180 мс + простой ─► │
 │        ▼                                    localStorage['wordMemorizer']  │
 │   render() ─► renderScreen() ─► renderXxxView() → HTML-строка              │
 │        │                                                                   │
 │        ▼                                                                   │
 │   setAppHtml(#app): новый экран — innerHTML; тот же экран — точечный патч  │
 └────────────────────────────────────────────────────────────────────────────┘
```

Ключевые свойства:

- **Нет сервера, сборки и внешних библиотек.** Ни одного сетевого запроса из приложения: `fetch` вызывает только service worker, когда файла нет в кэше.
- **Нет модулей.** Весь JavaScript — классический `<script>`, все функции объявлены на верхнем уровне и потому глобальны. На этом держится разметка: обработчики пишутся строкой — `onclick="openText(3)"`. **Переименовали функцию — ищите её имя и внутри шаблонных строк.** Обернуть код в модуль или IIFE нельзя: все `onclick` разом перестанут работать.
- **Одно глобальное состояние** `state`. Отрисовка — функция от `state` и данных; после любого действия вызывается `render()`.
- **Разметка собирается строками.** Шаблонные литералы `` `...${}...` ``, а пользовательский текст пропускается через `escapeHtml()`.

---

## 2. Файлы

| Файл | Роль | Когда меняется |
|---|---|---|
| `index.html` | Всё приложение: стили, разметка окон, логика | Почти в каждой правке; **после неё обязательно поднять версию в `sw.js`** |
| `sw.js` | Service worker: офлайн-кэш и обновление | Номер версии — при каждой правке `index.html`. Список файлов — при добавлении нового файла приложения |
| `fonts.css` | 41 `@font-face`: Inter 400/500/600/700 и Space Grotesk, разбитые по `unicode-range` | Никогда (см. CLAUDE.md) |
| `fonts/*.woff2` | Сами начертания, 1.2 МБ на всё; имя файла и есть версия содержимого | Никогда. Новое начертание — новый файл с новым именем |
| `manifest.json` | Установка на домашний экран: `start_url: ./index.html`, `display: standalone`, портретная ориентация, цвет `#1f1f1f` | Редко |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Иконки | Редко |
| `README.md` | Возможности и устройство — для человека | При каждой новой функции |
| `CLAUDE.md` | Правила, инварианты, грабли — для того, кто правит код | Когда найдена новая ловушка |
| `ARCHITECTURE.md` | Этот файл: карта кода и данных | При изменении структуры |
| `КАК РАЗМЕСТИТЬ НА GITHUB.md` | Публикация на GitHub Pages и обновление на телефоне | Редко |
| `.gitignore` | Только `.DS_Store` | — |

Документация в кэш service worker не попадает: правка `.md` не требует поднимать версию.

---

## 3. Внутреннее устройство `index.html`

| Строки (≈) | Что там |
|---|---|
| 1–12 | `<head>`: viewport без масштабирования, manifest, мета-теги для iOS, `fonts.css` |
| 13–6726 | `<style>` — все стили, около 6,7 тысячи строк |
| ≈6732 | `<div id="app"></div>` — пустой: экран целиком рисует `render()` при запуске. Раньше здесь лежал устаревший снимок экрана папок — его убрали, он лишь разбирался, начинал анимацию и тут же стирался |
| ≈6734–7056 | Пятнадцать модальных окон статичной разметкой (список в §8) |
| 7058–20836 | Основной `<script>`. Номера строк в таблице ниже пересчитаны по коду 2026-10-15; после следующих правок они снова поплывут — ищите по именам |
| 19567–19573 | Регистрация service worker по событию `load` |

### Стили

- `:root` (≈14) — палитра «тёмная оливковая», переменные `--bg-*`, `--text-*`, `--accent-*`, `--gradient-*`, `--shadow-*`.
- `body.dark-theme` (≈63) — вторая палитра, ещё глубже. Светлой темы нет: обе тёмные.
- `@media (prefers-reduced-motion: reduce)` (≈307) — гасит анимации.
- `.no-entry-anim` (≈324) — выключает анимации появления при обновлении того же экрана.
- Чипы слов: `.word`, `.word.hidden-word`, `.has-letters`, `.has-custom-hint`, `.hard-word`, `.practice-focus-active` и затухание соседей в режиме фокуса — ≈1262–1459.
- Альбомная ориентация: `@media (orientation: landscape) and (max-height: 560px)` (≈1163, ≈1538).
- Режим «Вписать» — ≈2571–2872, карточка термина — ≈4820, режим «Номера» — ≈4964, курсы — ≈5868 (`/* ===== COURSES ===== */`).
- Узкие экраны — `@media (max-width: 860px)` и `(max-width: 480px)` (≈5748).

> **Ловушка: селекторы повторяются.** Девятнадцать селекторов верхнего уровня объявлены дважды. Например, блок `/* Type mode styles */` скопирован целиком (≈2571 и ≈2873): `.type-input-wrap`, `.type-input-field` и соседние. При одинаковой специфичности побеждает последнее объявление. Перед правкой стиля найдите **все** вхождения селектора.

### Основной скрипт по областям

Порядок в файле — исторический, а не логический. Таблица идёт сверху вниз.

| Строки (≈) | Область | Ключевые функции |
|---|---|---|
| 6480–6531 | Глобальные переменные списка, тема, размер текста | `toggleTheme`, `loadTheme`, `loadPracticeTextScale`, `getTermCountText` |
| 6532–6642 | Форма материала, группы скрытых слов | `ensureTextStudyData`, `getHiddenWordGroups`, `computeHiddenWordGroups`, `getHiddenWordGroupByIndex`, `renderGroupsMemo` |
| 6643–6999 | Классификация токенов, отделение знаков препинания, ремонт индексов | `isPunctuationToken`, `isNumericListMarkerToken`, `isSlashSeparatorToken`, `splitEdgePunctuation`, `splitEdgeToken`, `repairWordIndexAlignment`, `applyPunctuationSplitToText`, `normalizeAllMaterialsPunctuation` |
| 7000–7283 | Перенос разметки при правке текста, объединение слов в вопросах | `buildContentWordIndexMap`, `remapProcessedTextState`, `updateMaterialContentPreservingProcessing`, `getRenderableHiddenIndices`, `buildBatchHintUnits`, `mergeBatchHintWithNext` |
| 7284–7391 | Поиск, сортировка, склонения | `filterTerms`, `clearSearch`, `toggleSort`, `getAllMaterialEntries`, `getCardCountText` |
| 7392–7487 | Нормализация карточек и курсов, встроенный набор карточек | `normalizeFlashcardCard/Folder/FoldersTree`, `normalizeCourseTask/Lesson/Folder/FoldersTree`, `getBuiltInFlashcardFolders`, `ensureBuiltInFlashcardFolders` |
| 7488–7833 | Значения по умолчанию, иконки, профиль | `getDefaultFlashcardSessionConfig`, `getDefaultFlashcardStudyState`, `getDefaultCourseStudyState`, `getDefaultProfile`, `getLocalProfile`, `saveProfile` |
| 7834–7920 | Очередь изучения: порядок перехода между материалами | `setStudyQueueFromVisibleEntries`, `getStudyNavigationMeta`, `getStudyNavigationTarget`, `applyStudyNavigationTarget` |
| 7921–8026 | **`state`** и переменные отложенной записи | `state`, `lastSavedData`, `renderQueuedWhileHidden`, `lastRenderSignature`, `HAS_TOUCH_INPUT` |
| 8027–8258 | Хранение и запуск, слушатели жизненного цикла | `scheduleIdleTask`, `flushSaveData`, `flushLocalStats`, `flushPendingPersistence`, `getLocalData`, `loadData`, `openStartupFolder`, `saveData` |
| 8259–8371 | Дерево папок, записи списка материалов | `ensureFolderShape`, `normalizeFoldersTree`, `getTopFolder`, `getCurrentFolder`, `getCurrentFolderTitle`, `buildTextsViewEntries`, `getTextLocationFromListIndex`, `shuffleVisibleTexts` |
| 8372–8575 | Статистика, мелкие помощники | `getLocalStats`, `saveLocalStats`, `buildStatsSummary`, `getFirstLettersOnly`, `getMaxHintLetters`, `shuffleArray`, `initGame`, `initQuiz` |
| 8576–8818 | **Конвейер отрисовки** | `syncElementAttributes`, `patchChildNodes`, `setAppHtml`, `render`, `renderScreen`, `syncDockSpacing` |
| 8819–9484 | Режим «Вписать» | `renderTypeView`, `normalizeTypeWord`, `convertKeyboardLayout`, `typeWordMatches`, `getTypeSequenceTokens`, `evaluateTypedWords`, `checkTypeWord`, `focusTypeField`, `syncTypeTextClamp`, `toggleTypeFocusLine`, а также `compactMarkup` и `getTermCardEntryDelay` |
| 9485–9723 | Смена режима, свайп и перетаскивание карточек, пометка сложных материалов | `setMode`, `initTermCardSwipe`, `initDragReorder`, `toggleAttention`, `resetAllAttention`, `toggleDifficultFilter` |
| 9724–9869 | Главная навигация и нижняя панель вкладок | `setPrimaryView`, `handlePrimaryCreateAction`, `openLearningBranch`, `renderBottomNav`, `renderShell` |
| 9870–10577 | Главная, «База знаний», хаб обучения, папки карточек | `renderHomeView`, `renderSharedView`, `renderLearningHubView`, `renderFlashcardFoldersView`, `renderFlashcardFolderView` |
| 10578–11225 | Курсы: действия, экраны, окна | `openCourseLesson`, `submitCourseQuizChoice`, `selectCourseMatchTerm`, `renderCourseFoldersView`, `renderCourseFolderView`, `renderCourseLessonEditView`, `renderCourseLessonView`, `saveCourseLesson`, `saveCourseTask` |
| 11226–11581 | Экраны изучения карточек | `renderFlashcardModeToolbar` (шапка, «↺ Начать заново»), `renderFlashcardModeComplete`, `renderFlashcard{Learn,Write,Test,Match,Browse}Body`, `renderFlashcardStudyView` |
| 11582–11785 | Статистика, экспорт папки в JSON, список папок, профиль | `renderStatsView`, `shareFolder`, `renderFoldersView`, `renderProfileView` |
| 11786–12000 | **Экран «Материалы»** (список материалов папки) | `renderTextsView` |
| 12001–12167 | Экран материала (выбор режима), шапка термина | `renderChooserView`, `navigateChooser`, `getTermNavHeader` |
| 12168–12417 | Фокус в практике, сложные слова | `getPracticeFocusTargets`, `getPracticeFocusSpan`, `advancePracticeFocus`, `focusNextPracticeWord`, `toggleHardWord`, `startHardPress`, `renderPracticeHiddenWord` |
| 12418–12763 | **Практика и выбор слов** | `renderPracticeView`: режимы `edit` и `practice`, а для остальных — диспетчер |
| 12764–13444 | Пример, карточки по строкам, карточка термина, вопросы к термину | `renderExampleView`, `buildLineCards`, `renderLineCardsView`, `formatContentForReading`, `renderTermCardView`, `renderQuestionsView`, `saveQuestionEntry` |
| 13445–13726 | «Собери текст», тест по материалу, тест по папке | `renderGameView`, `renderQuizView`, `selectQuizOption`, `renderFolderQuizView` |
| 13727–14065 | Окно запуска игр, перенос материалов в модуль, логика теста по папке | `openGameSetup`, `startGameWithSelected`, `showTransferTermsModal`, `transferSelectedTermsToSubfolder`, `startFolderQuiz` |
| 14066–14329 | Запись статистики, «Сопоставление», правка и удаление материала из списка, ход в «Собери текст» | `recordStudyStats`, `startMatchingGame`, `renderMatchingView`, `editTerm`, `deleteTerm`, `selectWord` |
| 14330–15394 | Открытие папок, карточки: действия и движок изучения | `openFolder`, `openFlashcardFolder`, `startFlashcardMode`, `prepareLearnPrompt`, `advanceLearnPrompt`, `armFlashcardTimer`, `syncFlashcardTimer`, `resolveFlashcardMatchAttempt` |
| 15395–15587 | Навигация по текстам | `openSubfolder`, `openText`, `openTermInMode`, `switchStudyModeByHotkey`, `goBack`, `goBackToTexts`, `goBackToChooser` |
| 15588–15642 | Экранирование, переход между материалами | `escapeHtml`, `escapeHtmlAttr`, `navigateToTerm` |
| 15643–15729 | Поле описания: автонумерация списков | `handleDescriptionFocus`, `insertNextListNumber`, `renumberListBelow`, `handleDescriptionBeforeInput` |
| 15730–16091 | Форматы переноса, выбор материалов, копирование | `buildProcessedDescriptionExport`, `buildProcessedFolderExport`, `parseProcessedFolderImport`, `parseProcessedDescriptionImport`, `parseCombinedMaterialImport`, `copyPlainTextToClipboard`, `toggleTextSelection`, `copySelectedMaterials` |
| 16092–16392 | Вставка в поля, открытие окон, картинки | `handleTitleFieldPaste`, `handleDescriptionPaste`, `handleFolderNamePaste`, `showFolderModal`, `showTextModal`, `handleImageUpload` |
| 16393–17042 | Загрузка списка карточек: текст, .xlsx, .docx, .csv | `FLASHCARD_IMPORT_TEMPLATE`, `parseFlashcardBulkImport`, `readZipTextEntries`, `inflateZipEntry`, `xlsxToPlainText`, `docxToPlainText`, `csvToPlainText`, `applyFlashcardImport` |
| 17043–17222 | Закрытие окон, Escape, Cmd+Shift в окне материала | `closeModal`, `handleEscapeAction`, `saveTextAndSelectWords`, `runModalShortcut` |
| 17223–17480 | Сохранение из окон, загрузка списка материалов, порядок и удаление папок | `saveFolder`, `saveFlashcard`, `saveText`, `processBulkImport`, `moveFolder`, `deleteFolder` |
| 17481–17752 | Выбор слов: отметка, скрытие, вопросы к словам | `toggleMark`, `applyBatchHide`, `selectAllPendingWords`, `showBatchHintModal`, `saveCurrentWordHint`, `finishBatchHint`, `saveHint` |
| 17753–17916 | Практика: раскрытие и подсказки | `getActivePracticeTargetIndex`, `revealNextHintLetter`, `revealWord`, `toggleAllWordsReveal`, `resetReveal`, `setPracticeTextScale`, `clearMarks` |
| 17917–18354 | Запуск: тема и масштаб, **диспетчер клавиатуры**, `loadData()` | безымянный обработчик `keydown` |

Озвучка появилась после пересчёта таблицы и в ней не отражена. На 2026-10-30 (v141) она занимает ≈13923–15556 — между режимом «Номера» и карточкой «термин ↔ текст»: хранение, запись, загрузка файла (`// ——— Загрузка аудиофайла`), воспроизведение, кнопка в шапке и плеер (`// ——— Плеер озвучки`, ≈14486: окно, управление, границы блоков, поиск пауз, дорожка под пальцем, клавиши). Ищите по заголовкам `// ———`.

---

## 4. Состояние

### Глобальный объект `state` (≈7921)

Объявлен через `let`, поэтому в `window` не попадает: из консоли он доступен, а из соседнего `iframe` — только как `frame.contentWindow.eval('state')`.

**Навигация**

| Поле | Значения и смысл |
|---|---|
| `view` | Открытый экран — список в §6 |
| `mode` | Режим внутри материала: `edit`, `practice`, `type`, `game`, `quiz`, `linecards`, `numbers`, `questions`, `termcard`, `example`; `null` — на экране выбора режима (`term_chooser`) |
| `practiceMode` | Вид скрытых слов в режиме `practice`: `default` — пустая плашка, `firstletter` — первая буква, `hints` — свой вопрос. Устаревшее `combined` молча превращается в `default` |
| `typeDisplayMode` | То же для «Вписать»: `default`, `letters`, `hints` |
| `learningBranch` | `texts`, `cards`, `courses` или `null` |
| `currentFolder` | Индекс папки верхнего уровня в `state.folders` |
| `currentSubfolder` | Индекс модуля внутри неё или `null` — тогда открыта сама папка |
| `currentText` | Индекс материала **внутри текущей папки** (`getCurrentFolder().texts`), а не в списке на экране |
| `returnToRootTexts` | Материал открыт из общего списка папки, хотя лежит в модуле: «Назад» вернёт в общий список |
| `studyQueue`, `studyQueueIndex`, `studyQueueOriginSubfolder` | Снимок видимого списка на момент открытия материала: по нему ходят стрелки ← → (с учётом поиска, сортировки и перемешивания) |
| `currentFlashcardFolder`, `editingFlashcardIndex` | Карточки |
| `currentCourseFolder`, `currentCourseLesson`, `editingCourseLessonMode`, `editingCourseTaskIndex`, `courseTaskTypeDraft` | Курсы |

**Работа с материалом**

| Поле | Смысл |
|---|---|
| `pendingWords` | Слова, выделенные в режиме «Выбор», но ещё не скрытые |
| `pendingHintGroups` | Объединения слов, собранные в окне вопросов до сохранения |
| `batchHintUnits`, `batchHintIndex`, `batchSkippedWords` | Пошаговое окно «Скрыть через вопросы» |
| `pendingWordIndex` | Слово в окне одиночного вопроса |
| `practiceFocusEnabled`, `practiceFocusWordIndex` | Режим фокуса в практике и слово под ним |
| `typeState` | `{ currentIndex, solved[], peeked[], wrongWords[], value, answered, isCorrect, singleWrongWord }`. `peeked` — слова, открытые нажатием; они входят и в `solved`. Создаётся `resetTypeState()`; начальное значение в объявлении `state` неполное — без `solved` и `wrongWords`, поэтому чтение идёт через `getSolvedTypeWords()` |
| `typeFocusLineEnabled` | Фокус на строке в «Вписать» |
| `lineCardFlipped`, `lineCardCueMode` (`letter` или `word`), `termCardFlipped`, `questionsCardFlipped` | Стороны карточек |
| `termCardFullscreen`, `termCardSizeControlOpen` | «Карточка» во весь экран и открыт ли ползунок «Aa». Полноэкранный сбрасывают `setMode`, `openTermInMode`, `goBackToChooser` (`resetTermCardFullscreen`); переход к соседнему материалу его сохраняет |
| `gameState`, `quizState` | «Собери текст» и тест по материалу |
| `folderQuizMode`, `matchingMode`, `matchingState` | Игры по папке. Пока флаг поднят, `renderTextsView` рисует игру вместо списка |
| `editingText`, `editingTermIndex`, `editingTermSubfolder`, `editingQuestionIndex` | Что именно правит открытое окно |
| `pendingDescriptionImport`, `pendingFolderImport` | Разобранный перенос, ждущий сохранения окна |
| `textsSelectionMode`, `selectedTextKeys` | Режим «Выбрать материалы». Ключи вида `root:3` или `subfolder-1:0` |
| `cardSelectionMode`, `selectedCardIndexes` | Режим «Выбрать карточки» в папке флеш-карточек: номера карточек в папке. Сбрасывается (`resetFlashcardSelectionState`) при открытии и закрытии папки, запуске изучения, переходе по разделам |
| `showDifficultOnly` | Фильтр «только сложные» в списке |
| `folderModalMode` | Для чего открыто общее окно папки: `root`, `subfolder`, `card_root`, `course_root` |

**Данные и прочее**

| Поле | Смысл |
|---|---|
| `folders`, `flashcardFolders`, `courseFolders` | Все данные пользователя (§5) |
| `profile` | Профиль |
| `flashcardSessionConfig`, `flashcardStudyState`, `courseStudyState` | Сеансы изучения; на диск не пишутся |
| `practiceTextScale`, `practiceSizeControlOpen` | Размер текста (0.5–1.5) и открыт ли ползунок «Aa» |
| `learningGuideOpen` | Раскрытые справки на экране «Обучение» |

### Переменные вне `state`

Часть состояния исторически живёт в отдельных `let` верхнего уровня:

| Переменная | Смысл |
|---|---|
| `searchQuery`, `sortReversed` | Поиск и обратный порядок в списке материалов |
| `flashcardSidesNotice`, `flashcardSidesNoticeTimer` | Подсказка «стороны поменяны» после `E` в папке карточек: ~2,6 с, затем элемент убирается из DOM без перерисовки |
| `cardSortReversed` | Обратный порядок списка «Карточки в папке» (`toggleFlashcardSort`, кнопка `.list-sort-btn` и `W`). Карточки всегда дописываются в конец `cards[]`, поэтому обратный порядок массива — «сначала новые». Строки по-прежнему несут исходный индекс карточки (правка, удаление, выбор), на диск не пишется. Его же читает `getFlashcardOrder`: без перемешивания изучение идёт в порядке списка («Изучать», `1`, «Только сложные», «Просмотр», «Письмо») |
| `textsViewEntriesCache` | **Видимый список материалов** — его заполняет `renderTextsView()`. По индексу в нём работают `openText(vi)`, свайп, перетаскивание и выбор. Отрисовка здесь не чистая: она пишет кэш, от которого зависят действия |
| `shuffledTextEntryKeys`, `shuffledTextEntryScope` | Перемешанный порядок и для какой папки он действует |
| `quizFocusedOption` | Вариант, выбранный стрелками в тесте |
| `renderGroupsMemo` | Память групп скрытых слов на время одной отрисовки (CLAUDE.md) |
| `lastRenderSignature` | `view + '|' + mode` прошлой отрисовки: тот же экран или новый |
| `rebuildNextRender` | Одноразовая просьба собрать экран начисто вместо патча — ставит `renderRebuilt()` |
| `practiceTextAnchor`, `nextPracticeScrollAnchor` | Практика: закреплённый отступ текста в карточке (ключ материала и ширины) и подсказка, какое слово держать на месте при следующей отрисовке |
| `cardSearchQuery` | Поиск в списке «Карточки в папке» |
| `numbersRevealKey`, `numbersRevealCount` | Режим «Номера»: какой материал открыт и сколько слов в нём показано |
| `audioError`, `audioRecording`, `audioPlayback`, `audioPlayerEl`, `audioUrlCache`, `audioDbPromise`, `audioFileTarget`, `audioImporting` | Озвучка: сообщение об ошибке (показывает плеер), идущая запись, проигрывание (`{ itemIndex, text, queue, all, loading, startAt, seekPending }`), элемент `Audio`, ссылки на звук открытого материала, соединение с IndexedDB, куда класть выбираемый файл (`{ text, itemIndex }`) и идёт ли его загрузка |
| `audioPlayerView`, `audioPlayerDrag`, `audioPlayerRate` | Плеер озвучки: его состояние (`{ text, clip, stamp, position, block, editing, tap, notice, searching, layout, exactDuration, open, headTransform, rateMenu, source }` — живёт и после закрытия, пока не открыли другой материал; `rateMenu` — открыт ли список скоростей, `source` — панель «Файлы и записи»), идущий жест на дорожке и скорость |
| `renderQueuedWhileHidden` | Отрисовка, отложенная, пока приложение свёрнуто |
| `lastSavedData`, `hasPendingSaveData`, `saveDataTimer`, `saveDataIdleId`, `pendingStatsPayload`… | Отложенная запись |
| `gameSetupType`, `gameSelectedTerms`, `transferSelectedTerms`, `transferSearchQuery` | Окна запуска игр и переноса в модуль |
| `hardPressTimer`, `hardPressHandled` | Долгое нажатие на слово |
| `flashcardTimerInterval`, `flashcardTimerLastSecond` | Таймер ответа на карточку. Несмотря на имя — `setTimeout`, а не `setInterval` |
| `cmdShiftArmed`, `cmdShiftHoldTimer` | Сочетание Cmd+Shift в окне материала |
| `authUser`, `sharedToken`, `serverVersion` | Остатки серверной версии; ни на что не влияют |

---

## 5. Данные и хранение

### Ключи `localStorage`

| Ключ | Содержимое | Кто пишет |
|---|---|---|
| `wordMemorizer` | `{ folders, flashcardFolders, courseFolders }` — всё, что создал пользователь | `saveData()` → `flushSaveData()`, отложенно |
| `wordMemorizerStats` | `{ sessions: [{date, mode, total_questions, correct_answers, folder_name}], totals: {total_sessions, total_questions, total_correct} }` | `recordStudyStats()` → `saveLocalStats()`, отложенно |
| `wordMemorizerProfile` | `{ fullName, region, email, siteLinked, linkedAt }` | `saveProfile()`, сразу |
| `darkTheme` | `'1'` — глубокая палитра, `'0'` — обычная. Пока ключа нет, тема следует системной | `toggleTheme()`, сразу |
| `practiceTextScale` | Проценты строкой, например `'115'` | `setPracticeTextScale()`, сразу |
| `audioPlayerRate` | Скорость плеера озвучки — одно из `AUDIO_PLAYER_RATES`: от `'0.5'` до `'2'`; чужое значение читается как `1` | `setAudioPlayerRate()`, по выбору в списке |
| `wordMemorizerBuiltInSets` | JSON-массив названий готовых наборов карточек, которые уже предлагались | `ensureBuiltInFlashcardFolders()`, при запуске, только если список изменился |

Кроме `localStorage` есть одно хранилище — **IndexedDB `zapominalkaAudio`**, хранилище `clips`: звук к материалам — свои записи и загруженные аудиофайлы (см. §9, «Озвучка материалов»). Ключ — `«text.audio.id»:«номер пункта»` (звук ко всему тексту — номер `-1`, `AUDIO_WHOLE_INDEX`), значение — `{ data: ArrayBuffer, type }`. Ключи `speechVoice` и `speechRate` в `localStorage` остались от автоматической озвучки (до v138) — их удаляет запуск. Cookies и `sessionStorage` не используются. `localStorage` даёт около 5 МБ на всё; самое объёмное там — картинки в base64 внутри материалов и карточек.

### Схема `wordMemorizer`

```
{
  folders: [                              // тексты: папки → модули → материалы
    {
      name: "Термины",
      texts: [ Text, ... ],
      subfolders: [                       // «модули»; в интерфейсе ровно два уровня,
        { name, texts: [Text], subfolders: [] }   // хотя нормализация рекурсивна
      ]
    }
  ],
  flashcardFolders: [
    {
      name, description,
      cards: [ { front, back, image, attention, sourceLabel, sourceUrl } ]
    }
  ],
  courseFolders: [
    {
      name,
      doneLessonIds: ["lesson_x", ...],   // пройденные уроки; открывают следующий
      lessons: [
        {
          id, emoji, title, sub, theory,
          tasks: [
            { type: "quiz",  q, options: [..], correct: [индексы], multi, explain },
            { type: "match", q, pairs: [[термин, определение], ...], explain }
          ]
        }
      ]
    }
  ]
}
```

### Материал (`Text`)

Форму задаёт `ensureTextStudyData()`: она дозаполняет недостающие поля, поэтому старые сохранения открываются после добавления новых. Новое поле добавляйте туда.

| Поле | Тип | Смысл |
|---|---|---|
| `title` | строка | Название; оно же лицевая сторона в режиме «Карточка» |
| `content` | строка | Описание. Знаки препинания хранятся отделёнными пробелами: «( текст ) ,» |
| `example` | строка | Пример для режима «Пример» |
| `image` | строка | Картинка в base64 или URL |
| `attention` | bool | Материал помечен сложным: свайп вправо, `S`, кнопка ☆ |
| `hiddenWords` | `number[]` | **Индексы токенов** `content.split(/(\s+)/)` — скрытые слова |
| `revealedWords` | `number[]` | Открытые сейчас. Состояние экрана, а не данные: сбрасываются при каждом входе в материал и при переходе между материалами. **На диск уходят пустыми** (`stringifyPersistentData`), в памяти живут, пока материал открыт |
| `halfRevealedWords` | `number[]` | Слова с живой подсказкой; сбрасываются там же и так же не пишутся на диск |
| `hintLetters` | `{индекс: число}` | Сколько букв открыто подсказкой. Читается только для слов из `halfRevealedWords`; как и они, на диск не пишется (`stringifyPersistentData`) |
| `hardWords` | `number[]` | Слова, отмеченные сложными (красные чипы) |
| `wordHints` | `{индекс: строка}` | Свои вопросы к словам; пустая строка — вопроса нет |
| `hiddenWordGroups` | `{ведущий: number[]}` | Несколько соседних скрытых слов под одной плашкой; ключ — индекс первого слова |
| `hintTypes` | `{индекс: 'default'}` | **Мёртвое поле:** пишется, но нигде не читается |
| `questions` | `string[]` | Вопросы к термину целиком (режим «Вопросы») |
| `audio` | `{ id, items: { номер: { d, t, n, b } } }` | Звук к пунктам и ко всему тексту (номер −1): `id` — ключ звука в IndexedDB, `items` — что озвучено, `d` — длительность в целых секундах (0 — неизвестна), `t` — когда добавлен, `n` — имя загруженного файла, `b` — границы блоков плеера в секундах с десятыми (по одной на стык, на одну меньше, чем строк). Сам звук в материале не хранится |
| `cardTextScale` | число 0.5–2 | Размер текста этой карточки в режиме «Карточка». Нет поля — 1; при 100% поле удаляется (`setTermCardTextScale`) |
| `semanticKeys` | `[{start, end, text}]` | **Мёртвое поле** от смысловых ключей; может встречаться в старых данных |

### Индексы слов — главный инвариант

```
content = "Скорость  вычислений ,\nGPU"
content.split(/(\s+)/)
  → ["Скорость", "  ", "вычислений", " ", ",", "\n", "GPU"]
       0          1      2             3    4    5     6
hiddenWords: [2]  →  скрыто «вычислений»
```

- Индекс — позиция в массиве **вместе с пробелами**. Слова всегда стоят на чётных позициях, разделители — на нечётных. Если текст начинается с пробела, `split` кладёт в начало пустую строку: `"  a b"` → `["", "  ", "a", " ", "b"]`, и первое слово получает индекс 2, а не 0.
- Любой код, который работает с индексами, обязан токенизировать **ровно так**. `match(/\S+|\s+/g)` этой пустой строки не даёт и на таком тексте расходится со `split` на единицу — однажды из-за этого часть разметки встала на пробелы, а номера на чипах шли через один (CLAUDE.md).
- `repairWordIndexAlignment()` проверяет, что индексы стоят на словах, и возвращает их на место. Вызывается из `applyPunctuationSplitToText`, то есть при запуске для всех материалов (`normalizeAllMaterialsPunctuation`) и при каждом сохранении материала (`saveText`). Быстрый путь — `isWordIndexAlignmentCanonical()`.
- Правка текста (`updateMaterialContentPreservingProcessing` → `buildContentWordIndexMap` + `remapProcessedTextState`) сопоставляет старые и новые слова — общий префикс, общий суффикс и поиск в середине — и переносит на новые позиции все поля с индексами.
- Отделение знаков (`applyPunctuationSplitToText` → `splitEdgePunctuation` → `splitEdgeToken`) возвращает `indexMap` и тоже переносит разметку.

**Добавляете новое поле с индексами слов** — научите его переносу в трёх местах: `remapProcessedTextState`, `repairWordIndexAlignment`, `applyPunctuationSplitToText`. Иначе после правки текста или при запуске оно окажется на чужих словах.

### Запись на диск

```
действие → saveData()
             ├─ hasPendingSaveData = true
             └─ setTimeout(180 мс) → requestIdleCallback(timeout 500) → flushSaveData()
                                                                          ├─ нормализация деревьев
                                                                          ├─ stringifyPersistentData() — JSON без открытых слов
                                                                          └─ если ≠ lastSavedData → localStorage.setItem
saveData(true)              — записать сразу
flushPendingPersistence()   — сбросить всё ожидающее (visibilitychange→hidden, pagehide, beforeunload)
```

Не каждое действие вызывает `saveData()`: раскрытие слов (`revealWord`, `toggleAllWordsReveal`) меняет `revealedWords` без записи — эти поля всё равно обнуляются при следующем входе.

`stringifyPersistentData()` на время сериализации подменяет непустые `revealedWords`, `halfRevealedWords` и `hintLetters` пустыми и возвращает их в `finally`. Без этого каждое открытое слово делало данные «изменившимися», и `navigateToTerm` (он вызывает `saveData()`) переписывал на диск все материалы при каждом переходе: на пяти материалах — 5.8 МБ записи вместо нуля. Новое поле, которое тоже только состояние экрана, обнуляйте там же.

`lastSavedData` при запуске — это строка, прочитанная из хранилища (`getLocalData().raw`), а не повторная сериализация данных: запись пропускается, только если новые данные совпадают с тем, что уже лежит на диске.

### Запуск: `loadData()` (≈8145)

```
loadTheme(); loadPracticeTextScale()             — ещё до данных, внизу скрипта
loadData():
  getLocalData()                                 — разбор wordMemorizer; при ошибке пусто
  normalizeFlashcardFoldersTree / normalizeCourseFoldersTree
  getLocalProfile()
  normalizeFoldersTree(state.folders)            — у каждой папки есть texts и subfolders
  normalizeAllMaterialsPunctuation()             — отделение знаков + ремонт индексов у всех материалов
  ensureBuiltInFlashcardFolders(!raw)            — подкладывает готовые наборы, которые ещё ни разу не предлагались
  если что-то изменилось → saveData(true)
  state.view = 'home'
  openStartupFolder() || render()                — сразу открыть папку «Термины» (STARTUP_FOLDER_NAME)
```

Готовые наборы карточек (`getBuiltInFlashcardFolders`) предлагаются один раз: их названия запоминаются в `wordMemorizerBuiltInSets`, и удалённый или переименованный набор больше не возвращается. Если ключа ещё нет, а данные уже были, все текущие наборы считаются предложенными: прежние версии подкладывали их при каждом запуске, так что отсутствующий набор был удалён. На чистой установке (`raw` пустой) наборы подкладываются. Новый набор в будущей версии придёт один раз — его названия в списке нет.

---

## 6. Экраны и переходы

`state.view` выбирает функцию отрисовки в `renderScreen()` (≈8708):

| `view` | Функция | Что это |
|---|---|---|
| `home` | `renderHomeView` | Главная: приветствие, достижения, быстрый доступ |
| `learning` | `renderLearningHubView` | «Обучение»: выбор ветки — тексты, карточки, курсы |
| `stats` | `renderStatsView` | «Прогресс» |
| `profile` | `renderProfileView` | Профиль, тема |
| `shared` | `renderSharedView` | «База знаний» — заготовка; сюда ведёт одна карточка на главной |
| `folders` | `renderFoldersView` | Папки текстов |
| `texts` | `renderTextsView` | Материалы папки или модуля; при `folderQuizMode` или `matchingMode` — игра по папке |
| `term_chooser` | `renderChooserView` | Экран материала: выбор режима изучения |
| `practice` | `renderPracticeView` | Все режимы материала, кроме «Вписать» |
| `type` | `renderTypeView` | «Вписать» |
| `card_folders` / `card_folder` / `card_study` | `renderFlashcardFoldersView` / `renderFlashcardFolderView` / `renderFlashcardStudyView` | Карточки |
| `course_folders` / `course_folder` / `course_lesson` / `course_lesson_edit` | `renderCourseFoldersView` / `renderCourseFolderView` / `renderCourseLessonView` / `renderCourseLessonEditView` | Курсы |
| `keys`, `keys_edit` | — | Устаревшие значения; `renderScreen` переводит их на `term_chooser` |

### Ветка текстов

```
 home ──setPrimaryView('learning')──► learning ──openLearningBranch('texts')──► folders
   ▲                                                                              │ openFolder(i)
   │ (при запуске сразу — openStartupFolder)                                      ▼
   │                                              ┌─────────────────────────── texts ◄── goBack() из модуля
   │                                              │  openSubfolder(j)           │  ▲
   │                                              ▼                             │  │ goBackToTexts()
   │                                      texts (модуль) ──────openText(vi)─────┤  │
   │                                                                            ▼  │
   │                                                                     term_chooser
   │                                         openTermInMode(i, mode) / клавиши 1–6 │ ▲ goBackToChooser()
   │                                                                               ▼ │
   │                                     practice (mode: edit | practice | game | quiz |
   │                                               linecards | questions | termcard | example)
   │                                     type     (mode: type)
   │                                     внутри: setMode(m) — панель режимов; ← → — navigateToTerm(±1)
```

- `openText(vi)` принимает индекс **в видимом списке** и переводит его в место хранения через `getTextLocationFromListIndex()`, а заодно запоминает очередь `studyQueue`.
- `openTermInMode(index, mode, practiceSubMode)` — главный вход в режим. Он сбрасывает `revealedWords` и `halfRevealedWords`, фокус и выделение, а также запускает `initGame`, `initQuiz` или `initTypeMode`.
- `setMode(mode)` — смена режима с панели внутри материала. Её нет в `edit` и `practice`: туда и обратно переключают клавиши 1–6 и «Назад».
- `navigateToTerm(±1)` — соседний материал в **том же** режиме, по очереди `studyQueue`.
- `setPrimaryView(view)` — вкладки нижней панели. Переход в `learning` или `folders` сбрасывает всю навигацию.

### Режимы материала (`state.mode`)

| `mode` | Название в интерфейсе | Рисует | Подготовка |
|---|---|---|---|
| `edit` | «Выбор» (выделить слова) | `renderPracticeView`, ветка `edit` | — |
| `practice` | «Практика»: ???, П_, ? — по `practiceMode` | `renderPracticeView` | — |
| `type` | «Вписать» (`view = 'type'`) | `renderTypeView` | `initTypeMode` → `resetTypeState` |
| `game` | «Собери текст по словам» (на панели — «Игра») | `renderGameView` | `initGame` |
| `quiz` | «Тест»: выбрать верное определение среди других материалов | `renderQuizView` | `initQuiz` |
| `linecards` | «Строки»: первые буквы или слова каждой строки | `renderLineCardsView` | `lineCardFlipped = false` |
| `numbers` | «Номера»: только номера строк, текст открывается по порядку | `renderNumbersView` | `resetNumbersReveal()` |
| `questions` | «Вопросы к термину» | `renderQuestionsView` | `questionsCardFlipped = false` |
| `termcard` | «Карточка»: название ↔ весь текст | `renderTermCardView` | `termCardFlipped = false` |
| `example` | «Пример» | `renderExampleView` | — |

**Панель режимов скопирована девять раз** — в `renderTypeView`, `renderExampleView`, `renderLineCardsView`, `renderNumbersView`, `renderTermCardView`, `renderQuestionsView`, `renderQuizView` и дважды в `renderGameView`: в игре и на экране её завершения. У самой практики (`mode = 'practice'`) панели нет. У каждой копии свой `active`. Кнопки — `.mode-btn` с `onclick="setMode('…')"`; подписи: Выбор, Практика, Вписать, Игра, Тест, Строки, Номера, Вопросы, Карточка, Пример. Найти все копии: `grep -n 'class="mode-toggle"' index.html`.

Копии уже разошлись: в панели `renderExampleView` нет «Вписать» и «Вопросов», в обеих панелях `renderGameView` нет «Вписать». Это не задумано — так получилось при добавлении режимов по одному. В `edit` и `practice` панели нет вовсе.

---

## 7. Конвейер отрисовки

```
render()
 ├─ приложение свёрнуто (document.hidden) → renderQueuedWhileHidden = true; выход
 │     (отложенная отрисовка выполнится по visibilitychange)
 ├─ renderGroupsMemo = new Map()          — память групп на одну отрисовку
 └─ renderScreen()
     ├─ body.practice-layout ⇔ view=practice и mode=practice
     ├─ тот же экран? (view|mode == lastRenderSignature)
     │     да  → #app.no-entry-anim (без анимаций появления), запомнить scrollY
     ├─ canPatchDom = тот же экран, view ≠ 'texts' и не просили пересборку (renderRebuilt → rebuildNextRender)
     ├─ html = renderXxxView()            — строка
     ├─ setAppHtml(#app, html, canPatchDom)
     │     нельзя патчить → innerHTML
     │     можно → <template>.innerHTML = html → patchChildNodes(app, template.content)
     │                 разное число детей → innerHTML этого поддерева
     │                 другой тег или тип узла → replaceChild(clone)
     │                 текст или комментарий → nodeValue
     │                 чип слова (data-widx) с тем же class, data-widx и текстом → пропуск
     │                 строка карточки (data-card-index) и isEqualNode → пропуск
     │                 иначе → syncElementAttributes (и value у полей) + рекурсия
     │     другое число узлов верхнего уровня → innerHTML (экран перестроен, а у фрагмента шаблона innerHTML нет)
     │     исключение → innerHTML (запасной путь)
     ├─ после: texts → initTermCardSwipe() (только сенсорный экран) и initDragReorder()
     ├─ syncFlashcardTimer(), syncDockSpacing()
     ├─ вернуть прокрутку, если это тот же экран
     ├─ практика: syncPracticeTextAnchor() (закрепить положение текста при входе),
     │     restorePracticeScrollAnchor() (докрутить на сдвиг слова, запомненного до отрисовки)
     └─ type → syncTypeTextClamp()        — строго после прокрутки
 finally: renderGroupsMemo = null
```

Следствия, на которые опирается код:

- **Экран «Материалы» всегда пересобирается целиком.** После отрисовки он навешивает слушатели на узлы, а при патче они навесились бы повторно.
- **Поля ввода переживают перерисовку**, если поддерево не пересобиралось. Поэтому условные блоки рядом с полями не вставляют, а прячут классом (CLAUDE.md).
- **CSS-переходы срабатывают при патче**: узел остаётся тем же, и у него есть прежнее значение, от которого можно анимировать.
- **Отрисовка не совсем чистая.** `renderTextsView` пишет `textsViewEntriesCache`, а при пропавшей папке меняет `view` и вызывает `render()`. `renderPracticeView` переносит `practiceFocusWordIndex`, если слово исчезло после правки текста. Менять разметку скрытия (`hiddenWords`, `hiddenWordGroups`) внутри отрисовки нельзя из-за `renderGroupsMemo`.
- `compactMarkup(html)` убирает пробелы между тегами в списках материалов и карточек — только там, где контейнеры flex (CLAUDE.md).
- `getTermCardEntryDelay(i)` ограничивает каскад появления карточек восемью шагами по 0.05 с, а `getTermCardEntryStyle(i)` даёт анимацию только первым `TERM_CARD_ANIMATED_LIMIT` (16) карточкам — остальные ниже края экрана и появляются сразу (`animation: none`).
- **Текст практики не скачет** (`syncPracticeTextAnchor`, `capturePracticeScrollAnchor` / `restorePracticeScrollAnchor`, переменные `practiceTextAnchor`, `nextPracticeScrollAnchor`). (1) Карточка центрирует текст (`justify-content: center`), и каждое изменение высоты текста сдвигало все строки на половину прибавки. После первой отрисовки материала отступ сверху, который дал центр, мерится и закрепляется: класс `is-anchored` и `--text-anchor-top` в `style` карточки, `justify-content: flex-start`. Ключ — папка, модуль, материал, `practiceMode` и ширина окна (`getPracticeTextAnchorKey`); при повороте экрана обработчик `resize` перерисовывает и меряет заново, смена одной высоты (панель Safari) не трогает. (2) Перед отрисовкой того же экрана практики запоминается слово, куда смотрят: под фокусом, если оно на экране; середина экрана, если `toggleAllWordsReveal` поставил `nextPracticeScrollAnchor = 'center'`; иначе первое слово под липкой шапкой (двоичный поиск по `.word`). После патча — `scrollBy` на его сдвиг, если он больше 2 px (1–2 px — это `translateY` чипа под фокусом). Это ручной scroll anchoring: в Chrome он есть сам, в Safari нет. (3) Ряд «Фокус…/Открыть слово» в доке рисуется всегда, когда есть скрытые слова, кнопки только `disabled`: исчезающий ряд менял высоту дока → `syncDockSpacing` уменьшал отступ → страница укорачивалась, и браузер подтягивал её вверх.
- **Длинные списки карточек.** Сверка узел за узлом выгодна, когда меняется немногое. Когда меняется почти каждая строка (порядок `W`, смена сторон у всех карточек), дешевле собрать экран заново: `renderRebuilt()` один раз отключает патч, сохраняя отсечку анимаций и прокрутку. Выбор карточек вовсе не перерисовывает экран — `syncFlashcardSelectionDom()` правит класс и галочку строк и две подписи панели выбора. Строки помечены `data-card-index`: по нему работает быстрый выход `isEqualNode` в `patchChildNodes` (полей ввода в строках нет — у них значение в свойстве, которое `isEqualNode` не видит), выбор и якорь прокрутки. Плюс `content-visibility: auto` у `.flashcard-row`: строки за экраном не раскладываются и не рисуются. Замеры на папке в 1000 карточек — в CLAUDE.md, «Длинные списки».
- Цели фокуса (`getPracticeFocusTargets`) внутри одной отрисовки считаются один раз — память лежит в той же `renderGroupsMemo` под строковым ключом `focusTargets:<practiceMode>`; при выключенном фокусе `renderPracticeView` их не считает вовсе.

### Анатомия чипа слова (практика)

```html
<span class="word hidden-word [has-letters|has-custom-hint] [hard-word]
             [practice-focus-active]"
      data-widx="12" onclick="revealWord(12)">…</span>
```

- `data-widx` — индекс токена. Его читают патч (быстрый выход), `findPracticeWordIndex` (долгое нажатие и правая кнопка мыши), прокрутка к слову.
- Открытое слово — `.word.revealed`, клик по нему вызывает `hideWordAgain(i)`.
- В режиме `edit` чипы другие: `.word.pending-selection`, `.marked`, `.has-hint`, клик — `toggleMark(i)`. Знаки препинания рисуются как `.word-punct` без обработчика.
- Пустая плашка держит размер за счёт `:empty::before { content: '0'; visibility: hidden }` — невидимой цифры.
- Группа (`hiddenWordGroups`) в режиме `hints` рисуется одним чипом у ведущего слова; остальные слова группы пропускаются (`suppressedIndexes`).

---

## 8. События и ввод

### Как обработчики попадают на элементы

1. **Строкой в разметке**: `onclick`, `oninput`, `onkeydown`, `onpaste`, `onmousedown` — основной способ, тысячи мест. Вызывают глобальные функции.
2. **Глобальные слушатели**, навешенные один раз при загрузке скрипта:

| Где (≈) | Событие | Зачем |
|---|---|---|
| 8228 | `document` `visibilitychange` | Сворачивание: остановить таймер карточек и сбросить запись. Возврат: выполнить отложенную отрисовку |
| 8244–8245 | `window` `pagehide`, `beforeunload` | `flushPendingPersistence` |
| 8251 | `window` `resize` | `syncDockSpacing` не чаще раза за кадр |
| 9395 | `visualViewport` `resize` | В «Вписать» — подстроить высоту текста под экранную клавиатуру |
| ≈12389 | `document` `touchstart`, `touchend`, `touchcancel`, `mousedown`, `mouseup`, `mouseleave` | Долгое нажатие (480 мс) — отметить слово сложным. `touchmove` подключается **только на время отсчёта** (`startHardPress` → `cancelHardPress`), чтобы обычная прокрутка не вызывала JavaScript |
| 12396 | `document` `click` (захват) | Погасить клик после сработавшего долгого нажатия |
| 12403 | `document` `contextmenu` | Правая кнопка мыши — отметить слово сложным |
| 17202–17221 | `keydown` и `keyup` (захват), `mousedown`, `blur` | Cmd+Shift в окне материала: сохранить и выделить слова |
| ≈13191 | `document` `fullscreenchange` | Вышли из полноэкранного режима браузера (Esc съедает браузер) — свернуть и полноэкранную карточку |
| 17919 | `document` `keydown` | **Главный диспетчер клавиатуры** |
| ≈14065 (`getAudioPlayer`, при первом звуке) | `audioPlayerEl` `ended`, `timeupdate`, `play`, `pause`, `durationchange` | Конец пункта и очередь; время, бегунок и текущий блок плеера; кнопка «Играть» и кнопка в шапке; точная длительность. Приходят только пока звук играет или грузится |

Дорожка плеера (`#apTrack`) получает `pointermove`, `pointerup`, `pointercancel` только на время жеста — их вешает `onAudioTrackPointerDown` и снимает `endAudioTrackDrag`. Так же и список скоростей: `pointerdown` на документе (в фазе перехвата, `onAudioRateMenuOutside` — закрыть список при нажатии мимо) висит, только пока список открыт; вешает и снимает его `setAudioRateMenu`, а закрывают список выбор скорости, нажатие мимо, `Escape` и закрытие плеера.

3. **После каждой отрисовки экрана «Материалы»** — `initTermCardSwipe()` (свайп вправо — сложный, влево — снять пометку; `touchmove` пассивный, ось жеста задаёт `touch-action: pan-y` у `.term-card`) и `initDragReorder()` (перетаскивание за ручку). Это единственное исключение из правила «не навешивать слушатели после render» — и причина, по которой этот экран не патчится.

### Диспетчер клавиатуры (≈17919): порядок проверок

Первое сработавшее правило завершает обработку. Новую клавишу вставляйте с учётом этого порядка.

1. Открыто окно вопросов (`batchHintModal`) — `,` `.` `б` `ю` игнорируются.
2. `Escape` → `handleEscapeAction()`: закрыть окно или вернуться назад. Затем `Cmd/Ctrl+Enter` при открытом `flashcardModal` → `saveFlashcard()`, при `flashcardImportModal` → `applyFlashcardImport()` (если кнопка «Добавить» активна). Стоит до шага 5 — нажимают из полей окна. Окно материала сохраняет по `Cmd+Enter` своим `handleTextModalKeys` на полях.
3. «Вписать» завершено, `Enter` пришёл не из поля → следующий материал.
4. Из поля `#typeInputField`: `↓` → фокус на строке; `←` `→` без модификаторов → соседний материал.
5. Фокус в любом другом `INPUT` или `TEXTAREA` → **дальше не идём**. Сразу за этим, без Cmd/Ctrl/Alt — открытый плеер озвучки (`handleAudioPlayerKey`): `Пробел` — играть/пауза (с `preventDefault`, иначе пробел нажал бы и кнопку в фокусе), `←` `→` — на 5 секунд, `↑` `↓` — блоки, `Enter` при разметке на слух — граница. Стоит раньше шага 19, иначе стрелки листали бы материалы под окном.
6. `Cmd/Ctrl+C` → «Скопировать материал» (выбор слов) или «Скопировать выбранные» (список материалов или папка флеш-карточек в режиме выбора). Во встроенном браузере Claude настоящее `Cmd+C` до страницы не доходит — проверять программным событием.
7. `Ctrl` без `Cmd` → выход. Затем `9` на любом экране (без открытых окон и `contenteditable`) — `openLearningBranch('cards')`, раздел «Карточки»; эта функция заодно выключает полноэкранную «Карточку».
8. Выбор слов: `1` — скрыть выделенное, `2` — скрыть через вопросы (только если что-то выделено; иначе `1`–`4` здесь молчат). `5` и `6` — «Вписать».
9. `1`–`6` на экране материала, в «Вписать» и в практике → `switchStudyModeByHotkey`.
10. Выбор слов: `/` — выделить все, `.` — следующее слово.
11. Список материалов: `N` — режим выбора, `W` — сортировка, `S` — перемешать. Папка флеш-карточек: `N` — режим выбора карточек, `W` — порядок списка (только если есть карточки и нет окон).
12. Внутри материала: `E` — правка. Папка флеш-карточек (`card_folder`, есть карточки, окон нет): `E`/`У` — `swapFlashcardSides`, без автоповтора (`e.repeat` игнорируется, иначе удержание меняло бы стороны туда-обратно).
13. `]` или `` ` `` — создать (на списках) или править (внутри материала).
14. Тест (материала или папки): `↑` `↓` `Enter`.
15. «Вписать»: `↓` — фокус на строке.
16. Практика: `Delete`/`Backspace` — выключить фокус, `↓` — фокус дальше, `Shift` — ещё букву, `↑` — открыть или скрыть все, `Enter` — `revealNextHiddenWordInOrder()` (без фокуса — первое по тексту неоткрытое скрытое слово из `getUnrevealedFocusTargets`; с фокусом — все неоткрытые скрытые до конца связки под фокусом через `markHiddenWordsRevealed` одной отрисовкой, затем `advancePracticeFocus`, если под фокусом было скрытое слово; если до фокуса нечего — следующее после фокуса, и фокус за него; группа в «?» — один шаг; `preventDefault` и на автоповторе, иначе браузер нажал бы кнопку под фокусом), `M` — сложное слово.
17. Экран папки флеш-карточек (`card_folder`): `1` — `startFlashcardStudy(false)`, как кнопка «Изучать»; в пустой папке молчит, как неактивная кнопка.
18. Флеш-карточки, режим `flashcards`, занятие не завершено, окон нет: `S` — `toggleCurrentFlashcardAttention`, `R`/`К` — `restartFlashcardFromStart`, `E`/`У` — `showEditFlashcardModal(order[current])`, `Пробел` и `↓` — `flipFlashcard`, `→` и `Enter` — `stepFlashcard(1)`, `←` — `stepFlashcard(-1)`. `preventDefault` обязателен: после клика фокус стоит на карточке-кнопке, и браузер сам «нажал» бы её, — действие сработало бы дважды. После завершения клавиши молчат, иначе лишнее «Дальше» записало бы занятие в статистику повторно.
19. Нужен открытый материал: `←` `→` — соседний (на экране выбора — `navigateChooser`), `R` — скрыть всё снова (практика), `S` — сложный материал. `Пробел` ничего не делает: поштучное раскрытие убрано.

Буквы сверяются по `e.key` сразу в обеих раскладках: `e`/`у`, `m`/`м`/`ь`, `n`/`н`/`т`. `Cmd+C` — по `e.code`.

### Модальные окна

Открытое окно — `.modal.show`, закрывает `closeModal(id)`. Окна статичны, лежат в `<body>` вне `#app` и при `render()` не пересоздаются:

`folderModal` (папка, модуль, папка карточек, курс — одно окно на всех), `questionModal`, `learningCreateModal`, `textModal`, `bulkImportModal`, `flashcardModal`, `flashcardImportModal`, `courseLessonModal`, `courseTaskModal`, `gameSetupModal`, `transferTermsModal`, `audioPlayerModal`, `hintModal`, `batchHintModal`. У `audioPlayerModal` статична только оболочка — всё содержимое рисует `renderAudioPlayer()`.

Окно открывает функция вида `showXxxModal()`: она заполняет поля и ставит фокус через `setTimeout(…, 100)`. Сохраняет `saveXxx()`: читает поля, меняет данные, затем `saveData()`, `closeModal()` и `render()`. `closeModal` снимает фокус с поля внутри закрытого окна: иначе фокус оставался бы в скрытом `TEXTAREA`, диспетчер считал бы, что идёт ввод (шаг 5), и горячие клавиши экрана молчали бы до клика.

---

## 9. Подсистемы

### Тексты: выбор и скрытие слов (`mode = 'edit'`)

```
клик по слову → toggleMark(i)
  слово уже скрыто → снять (и группу, если она есть); saveData; render
  иначе → добавить в state.pendingWords или убрать оттуда; render   (на диск не пишется)
«Скрыть слова» / клавиша 1 → applyBatchHide()   → hiddenWords += pending, wordHints[i] = ''
«Скрыть через вопросы» / 2 → showBatchHintModal() → buildBatchHintUnits → по одному:
      saveCurrentWordHint / skipCurrentWord / mergeBatchHintWithNext (группа) → finishBatchHint()
«Выделить все» / «/» → selectAllPendingWords()   — без знаков, номеров пунктов, «/» и уже скрытых
```

Классификаторы токенов: `isPunctuationToken` (весь токен — знаки), `isNumericListMarkerToken` («1.», «2)»), `isSlashSeparatorToken` («/»). Через них выбор слов, фокус и подсказки пропускают «не слова».

**Осторожно: `isNumericListMarkerToken` смотрит только на сам токен** и говорит «да» любому числу — «24», «4090», «9». Номер пункта от числа внутри фразы он не отличает. Фокус (`computePracticeFocusTargets`) поэтому использует `isLineStartListMarker(words, i)` — число первым токеном строки — и вдобавок никогда не пропускает скрытые слова. Раньше там стоял голый `isNumericListMarkerToken`, и «Фокус на следующем слове» перепрыгивал скрытые числа (часто — отмеченные сложными). Выбор слов (`selectAllPendingWords`, клавиша `.`) по-прежнему пропускает любые числа; нажатием число скрыть можно.

### Тексты: практика (`mode = 'practice'`)

- **Экран открывается без выделения.** Подсветки «следующего слова» (`.next-reveal`, `.next-highlight-mode`) больше нет — убрана вместе с кнопкой «Открыть следующее слово». Выделяет слово только режим фокуса, а включает его только `focusNextPracticeWord()` (кнопка «Фокус на следующем слове» и `↓`).
- **Слово для подсказки и `M`** — `getActivePracticeTargetIndex()` / `getHighlightedPracticeWordIndex()`: в фокусе — скрытое слово под ним, без фокуса — первое не открытое из `getRenderableHiddenIndices()` (в режиме `hints` у группы остаётся только ведущее слово). Видимой подсветки у него без фокуса нет.
- **Раскрытие**: `revealWord(i)` — нажатие на чип (в фокусе ещё и сдвигает фокус дальше), `toggleAllWordsReveal()` — главная кнопка «Показать все скрытые слова» / «↺ Скрыть все слова» и `↑`; открывая все слова, она выключает режим фокуса (`exitPracticeFocusMode`), а пряча — не включает его обратно; `resetReveal()` (`R`), `hideWordAgain(i)` — нажатие на открытое. Поштучного раскрытия кнопкой или пробелом нет.
- **Нижняя панель практики**: «Фокус на следующем слове» и «Открыть слово» (`revealNextHiddenWordInOrder`, как `Enter`; с фокусом открывает всё до слова под фокусом включительно; класс `practice-hint-btn` остался от прежней «Подсказки»). Видна, пока есть неоткрытые скрытые слова (`canOpenNext`).
- **Подсказка по буквам**: `revealNextHintLetter()` (кнопка `.practice-corner-hint-btn` в правом верхнем углу карточки и `Shift`). Кнопка лежит в `.text-display-row.has-corner-hint` рядом с карточкой, а не внутри неё (иначе кегль в em задевал бы её), и рисуется всегда, когда в тексте есть скрытые слова, — без цели она `disabled`: появление и исчезновение узла меняло бы число детей ряда, и патч пересобирал бы весь текст с чипами. Карточке добавлен `padding-top`, чтобы первая строка не уходила под кнопку. добавляет слово в `halfRevealedWords` и увеличивает `hintLetters[i]`. Предел — `getMaxHintLetters(word)`: число букв и цифр минус одна, так что последняя буква не открывается никогда. `getVisibleHintLetters` учитывает первую букву режима `firstletter`.
- **Фокус** (`practiceFocusEnabled`): цели — все слова, кроме знаков препинания, номеров пунктов и «/»; в режиме `hints` участники группы прячутся за ведущим (`getPracticeFocusTargets`). Шаг (`getPracticeFocusSpan`) — одно скрытое слово либо связка обычных слов до следующего скрытого. `advancePracticeFocus` переходит к концу связки, `focusNextPracticeWord` — клавиша `↓`.
- **Сложные слова**: `toggleHardWord(i)` пишет `hardWords` и сохраняет; долгое нажатие, правая кнопка мыши, `M`.
- **Размер текста**: `setPracticeTextScale()` пишет CSS-переменную `--user-text-scale` прямо в DOM, без `render()`.

### Тексты: «Вписать» (`view = 'type'`)

```
поле #typeInputField: oninput → handleTypeSequenceInput(value)   (без render)
Enter / «Проверить» → checkTypeWord()
   tokens = getTypeSequenceTokens(text, words)       — все слова: {index, hidden, normalized}
   evaluateTypedWords(tokens, solved, ввод.split(/\s+/))
       разбор с позиции после последнего вписанного скрытого слова (getTypeParseStart)
       обычные слова можно вписывать или пропускать; на обязательном скрытом — стоп
       ошибка не обрывает разбор: верные слова после неё тоже засчитываются
   typeState.solved, currentIndex, wrongWords, singleWrongWord; в поле остаётся первое неверное
   render(); focusTypeInputField(выделить неверное)   — синхронно, иначе iOS закроет клавиатуру
```

- Сравнение — `typeWordMatches(raw, expected)`: ввод нормализуется (`normalizeTypeWord`) и дополнительно сверяется после перевода раскладки (`convertKeyboardLayout`, таблицы `KEYBOARD_LAYOUT_RU` и `KEYBOARD_LAYOUT_EN`). Поэтому «cjcnjbn» засчитывается как «состоит».
- `getWordInputLanguage` рисует метку RU или EN у текущего слова.
- Когда открыта клавиатура, `syncTypeTextClamp()` ограничивает высоту текста (`.type-text-clamped`, `--type-text-max-height`) и поднимает поле (`.type-keyboard-open`, `--type-keyboard-inset`). Открытую клавиатуру выдаёт разница `innerHeight − visualViewport.height` больше 120 px.
- Фокус на строке: `getTokenLineNumbers` → `getTypeFocusLine` → в разметке остаётся одна строка.
- Нажатие на скрытый чип — `revealTypeWord(i)`: слово попадает в `solved` и `peeked`. Нажатие на открытое так слово (`.type-peeked`) — `hideTypeWord(i)`, убирает из обоих. Вписанное слово (в `solved`, но не в `peeked`) обработчика не имеет. Оба пути — `setTypeWordPeeked`; если из-за этого сменилось слово, которое просят вписать, сообщение об ошибке и неверный набор сбрасываются. У чипов `onmousedown="event.preventDefault()"`, чтобы нажатие не забирало фокус у поля и не закрывало клавиатуру.
- Завершение — то же `.type-card` с полным текстом; если часть слов открыта нажатием, заголовок «Текст открыт» и счёт «вписано N из M». `Enter` на нём ведёт к следующему материалу (диспетчер, пункт 3).

### Тексты: остальные режимы

- `game` — `initGame()` перемешивает слова в `gameState.scrambledWords`; `selectWord`, `removeFromResult`, `restartGame`.
- `quiz` — `initQuiz()` берёт описания до трёх других материалов той же папки как неверные варианты (нужно минимум два материала); `selectQuizOption`, `restartQuiz`.
- `linecards` — `buildLineCards()` по строкам (`getTextManualLines`), подсказка — первая буква или первое слово (`lineCardCueMode`).
- `numbers` — `buildNumbersLines()`: строки из `getTextManualLines(formatContentForReading(content))`, маркер строки (`NUMBERS_MARKER_RE`: «1.», «2)», «а)», «—», «•») или порядковый «N.», слова строки с приклеенными к ним знаками препинания (кроме тире: отдельно стоящее «—», «–», «-» идёт со следующим словом — «— ом», а не «сопротивления— ом»). Состояние — одно число открытых слов `numbersRevealCount` вне `state`, привязанное к материалу ключом `numbersRevealKey` (папка, подпапка, индекс, длина текста): сменился материал — счёт с нуля. `numbersHint` — +1 слово, `numbersShowLine` — до конца строки со следующим закрытым словом, при всём открытом — сброс. Стрелки на экране — `navigateToTerm(±1)`. Кнопка «Номера» стоит во всех панелях режимов рядом со «Строками»; у самой практики панели нет.
- `termcard` — `renderTermCardView`: лицевая сторона — `title`, оборотная — `formatContentForReading(content)`, где знаки снова прилеплены к словам. Хранит только размер текста — `text.cardTextScale` (переменная `--card-text-scale` на карточке; ползунок меняет её прямо в DOM без перерисовки, сохраняет `onchange`). При `state.termCardFullscreen` вместо обычной разметки рисуется слой `.termcard-fullscreen` (fixed, z-index 150, между шапками и окнами); `enterTermCardFullscreen` на компьютере и iPad ещё и вызывает `requestFullscreen`.
- `questions` — `text.questions`, окно `questionModal`.

### Озвучка материалов (окно `audioPlayerModal`)

- **Что это.** Звук к материалу добавляет сам пользователь: своя запись с микрофона или готовый аудиофайл (скачанный, например, из сервиса озвучки). Автоматической озвучки — голоса устройства (`speechSynthesis`) и нейроголосов Piper — нет с v138; их код, движок `tts/` и правила — в истории git до коммита `746ca7a`.
- **Одно окно.** С v141 у озвучки нет своего окна (`audioModal`, `showAudioModal`, `renderAudioModalList`, `getAudioItemRow` удалены) и кнопок «🔊 N» в практике и «Номерах»: добавить, заменить и удалить звук можно только в плеере. Вход — кнопка в шапке и карточка «🔊 Озвучка» на экране выбора режима, обе зовут `openAudioPlayer`.
- **Пункты** — строки `buildNumbersLines(text)` (как в «Номерах»). Звук ко всему тексту — номер `AUDIO_WHOLE_INDEX` (−1) в тех же `text.audio.items`: так его без особых случаев подхватывают подсчёт (`getTextAudioCount`), предзагрузка (`preloadTextAudio`) и удаление вместе с материалом (`forgetTextAudio`). Новый звук ложится на место звука плеера (`getAudioPlayerTarget`: `view.clip`, а если звука нет — −1); у материала из одной строки плеер играет и заменяет пункт 0, если звук был добавлен к нему. Звук к отдельным пунктам (добавлялся до v141) остаётся: играет в «Номерах» и «Пунктах по порядку», `getAudioLineClips` находит его для плеера.
- **Где хранится.** Звук — в IndexedDB (`openAudioDb`, `audioDbRequest`; база `zapominalkaAudio`, хранилище `clips`, ключ `id:номер`, значение `{ data: ArrayBuffer, type }` — `ArrayBuffer`, потому что `Blob` в IndexedDB старые Safari сохраняли ненадёжно). В материале — только `text.audio = { id, items: { номер: { d, t, n } } }` (`d` — секунды, 0 — неизвестно; `t` — когда добавлен; `n` — имя файла, только у загруженных), чтобы отрисовка синхронно знала, что озвучено. Запись не в `localStorage` намеренно: там она переписывалась бы целиком при каждом `saveData()` и съела бы 5 МБ за десяток записей.
- **Запись**: `startAudioRecording(i)` → `getUserMedia({audio:true})` вызывается синхронно в нажатии → `MediaRecorder` (формат — первый поддерживаемый из `audio/mp4`, `audio/webm;codecs=opus`, …, `pickAudioMimeType`). Счётчик на «Стоп» — `setTimeout` раз в секунду только во время записи; потолок `AUDIO_MAX_SECONDS` (300). `stopAudioRecording` → `finishAudioRecording`: дорожки микрофона останавливаются, запись уходит в `saveAudioClip` — общий с загрузкой файла: звук в базу, пометка в `text.audio.items`, старая ссылка из `audioUrlCache` выбрасывается, `saveData()`, однократно `navigator.storage.persist()`. Пока идёт запись, плеер рисует вместо дорожки её панель (`getAudioPlayerRecordingHtml`: время `#audioRecTime`, «■ Стоп и сохранить», текст по пунктам для чтения вслух) и прокручивается к началу. Закрытие плеера (`closeAudioPlayer`, в том числе `Escape`) и уход приложения в фон (`visibilitychange`) останавливают и сохраняют идущую запись.
- **Загрузка файла**: одно скрытое поле `#audioFileInput` в `#audioPlayerModal`, вне `#audioPlayerBody` — тело окна перерисовывается (`accept` — `audio/*` и расширения: на iPhone так открываются «Файлы»). `chooseAudioFile()` запоминает цель в `audioFileTarget` (`{ text, itemIndex }` из открытого плеера) и синхронно, в нажатии, зовёт `input.click()` — иначе iPhone поле не откроет. `onAudioFileChosen`: потолок `AUDIO_FILE_MAX_BYTES` (50 МБ); тип — `file.type`, а если он пуст — по расширению (`AUDIO_FILE_TYPES`); `readAudioFileDuration` пробует файл тем же `Audio`: ошибка плеера — сразу сообщение «не получается воспроизвести» и ничего не сохраняется; длительность из `loadedmetadata`; если плеер за 5 с ничего не сказал (iPhone может не читать звук до нажатия), файл принимается с `d: 0` — «Слушать» без времени. Дальше `saveAudioClip` с `n` — именем файла. Пока идёт загрузка, `audioImporting` гасит кнопки «Загрузить», «Записать» и «Удалить» в плеере.
- **Воспроизведение**: один плеер `audioPlayerEl` на всё приложение. Ссылки на записи открытого материала держит `audioUrlCache` (заполняет `preloadTextAudio` при открытии плеера и в «Номерах»), чтобы `play()` шёл прямо в нажатии: Safari на iPhone пускает звук только из жеста. Если записи ещё нет в памяти, плеер в нажатии получает пустой WAV (`SILENT_WAV`) — это «разрешение», — а настоящая запись подставляется, когда дочитается из базы; конец пустого звука `onAudioPlaybackEnded` не считает концом записи (`playback.loading`). «Слушать пункты по порядку» (`playAllAudio`) — очередь `playback.queue` из пунктов со звуком; звук ко всему тексту в неё не входит.
- **«Номера»**: `▶` (`playNumbersAudio`) у строки со звуком; у звучащей — `■`. `refreshAudioUi` перерисовывает экран при старте и остановке.
- **Карточка «🔊 Озвучка»** на экране выбора режима открывает плеер (`openAudioPlayer`); число на ней — сколько звуков у материала (вместе со звуком ко всему тексту).
- **Кнопка в шапке** — `getTermListenButton(text)` внутри `getTermNavHeader`, поэтому она есть во всех режимах изучения. `openAudioPlayer` открывает плеер всегда — и без звука: тогда плеер предлагает его добавить. Подсвечена (`active`), пока весь текст звучит и не на паузе (`isListeningWholeText`: `audioPlayback.all`, тот же материал, `loading` или `!audioPlayerEl.paused`). Рисуется всегда, при пустом тексте — `disabled`; подпись — `getTermListenButtonState(playing, hasAudio)`. На старте, паузе и остановке экран не перерисовывается: `syncTermListenButton` правит класс и подпись на месте (из `refreshAudioUi` и событий `play`/`pause`; в «Номерах» `refreshAudioUi` по-прежнему зовёт `render()`), разметка совпадает с `getTermListenButton` — после правки `render()` не меняет `#app.innerHTML`. Звук останавливают `navigateToTerm`, `goBackToTexts` и `setPrimaryView`; смена режима — нет.
- **Плеер** (`audioPlayerModal`, `// ——— Плеер озвучки`). Играет звук `view.clip`: ко всему тексту (−1), а у материала из одной строки — пункта 0 (`getAudioPlayerClip`); нет ни того, ни другого — пустое состояние (`getAudioPlayerEmptyHtml`): «📁 Загрузить файл» и «● Записать голосом», а при звуке к пунктам — «▶ Пункты по порядку» и «🗑 Удалить звук к пунктам». Проигрывание — тот же `playAudioItemFor(text, clip, [], true, startAt)`: место начала ставит `seekAudioElementOnLoad` после `loadedmetadata` (до этого Safari перемотку может забыть), пока не встал — `playback.seekPending`, и время берётся из `startAt`. Пауза — `audioPlayerEl.pause()` без снятия звука; состояние читаем у элемента (`isAudioPlayerPlaying`), потому что паузу ставит и сам iPhone. Скорость — `playbackRate` и `defaultPlaybackRate` (новый `src` сбрасывает её к последней); выбирается в выпадающем списке под кнопкой (`getAudioRateHtml`, `toggleAudioRateMenu`, `setAudioPlayerRate`). Открытие и закрытие списка — правка на месте (`setAudioRateMenu`: класс, `hidden`, `aria-expanded`), выбор — перерисовка окна. Внизу окна список докручивается в вид (`scrollIntoView`, `block: 'nearest'`), отступ под ним даёт `::after` с `scroll-margin-bottom`. `Escape` при открытом списке закрывает только список (`handleEscapeAction`). `closeAudioPlayer`: играющий звук продолжает играть; звук на паузе отпускается (`stopAudioPlayback`), место остаётся в `view.position`. Конец звука возвращает место в 0 (`onAudioPlaybackEnded`).
- **Блоки и границы**: блоки — строки `buildNumbersLines`, границы — `items[clip].b`. `getAudioBlockLayout(view)` берёт сохранённые, пока они идут по порядку (зазор `AUDIO_BLOCK_MIN_GAP`, 0,3 с) и умещаются в длительность, остальные прикидывает `estimateAudioMarks` — пропорционально числу букв строк от последней сохранённой до конца. Длительность — у элемента, когда он загрузил звук, до того — `view.exactDuration` от пробника `probeAudioDuration` (общий с загрузкой файла) или `d` из пометки; узнанную длительность `rememberAudioDuration` дописывает в пометку. `view.stamp` (`номер:t`) сбрасывает место и длительность, если звук заменили. Правка: перетаскивание кружков (`onAudioTrackPointerDown` → `updateAudioTrackDrag` правит два соседних отрезка и кружок → `endAudioTrackDrag` сохраняет и ставит плеер на начало блока; `pointercancel` всё возвращает), `nudgeAudioBlockStart` (±0,5 с), `setAudioBlockStartHere` («Сюда»), разметка на слух (`startAudioTapMarking` → `tapAudioBlockMark` с поправкой `AUDIO_TAP_REACTION` и раскладкой обогнанных границ заново → `cancelAudioTapMarking` возвращает `view.tap.backup`), `resetAudioBlockMarks`. Все пишут через `saveAudioBlockMarks` (десятые секунды, `saveData()`). Новый файл (`saveAudioClip`) заменяет пометку целиком — границы сбрасываются намеренно.
- **Поиск пауз** (`findAudioBlockMarksByPauses`): `findAudioPauses` читает звук (`fetch` по ссылке из `audioUrlCache`), раскладывает его `OfflineAudioContext.decodeAudioData` на 16 кГц (старые Safari — 44,1), считает громкость окнами по 20 мс, порог тишины — 10 % пути от тихого (10-й процентиль) к громкому (90-й); паузы — тишина от 0,25 с, кроме начала и конца. `pickAudioPauseMarks` — динамическое программирование: границы строго по порядку, сумма «длина паузы − 6/длительность × удалённость от прикидки» максимальна; прикидки тоже кандидаты с нулевой длиной, так что недостающие границы остаются на них. Граница — к концу паузы, за 0,2 с до слова.
- **Отрисовка плеера**: `renderAudioPlayer` собирает окно целиком на смену состояния (открытие, старт и стоп через `refreshAudioUi`, правка границ, длительность), во время жеста откладывает. Между ними по `timeupdate` (`onAudioTimeUpdate` → `syncAudioPlayerTime`) меняются только время, бегунок (`transform: translateX(N%)` у рельсы во всю ширину — процент от её ширины, то есть дорожки; переход 0,26 с сглаживает шаги события) и текущий блок (`syncAudioPlayerBlock` переставляет `is-current`). Таймеров и кадров анимации плеер не заводит — проверено счётчиками: в простое ноль вызовов, во время игры — только события элемента.
- **Звук в плеере** — `toggleAudioPlayerSource` открывает панель «Файлы и записи» (`view.source`, `getAudioPlayerSourceHtml`; с правкой границ взаимоисключающая): что звучит сейчас, «📁 Другой файл», «● Записать голосом», «🗑 Удалить звук», а если есть звук к пунктам — «🗑 Удалить звук к пунктам». После любой смены звука — `afterAudioChange(text)`: `refreshAudioPlayerClip` заново выбирает `view.clip` и по `view.stamp` сбрасывает место, длительность и правку границ (панель при этом закрывается), затем плеер и экран перерисовываются (число на карточке). Ошибки — `audioError`, плеер показывает их под заголовком (`.ap-error`).
- **Удаление**: `deleteAudioClips(text, indexes)` — общее: звук из базы, пометки из материала, ссылки из `audioUrlCache`, останавливает звучащий. Из плеера — `deleteAudioPlayerClip` (звук плеера) и `deleteAudioPlayerItems` (звук к пунктам, в том числе к пунктам, которых после правки текста уже нет), оба с подтверждением. `forgetTextAudio` / `forgetFolderAudio` удаляют записи при удалении материала, модуля или папки (`deleteTerm`, `deleteSubfolder`, `deleteFolderFromList`, `deleteFolder`).
- **Не переносится** текстом между устройствами; экспорт папки в JSON несёт только пометку `audio` без звука.
- `example` — `text.example`.

### Список материалов (`view = 'texts'`)

- `renderTextsView`: `buildTextsViewEntries()` — материалы папки плюс, если открыта сама папка, материалы всех её модулей. Записи — копии с `_textRef`, `_sourceIndex`, `_sourceSubfolderIndex`, `_entryKey`. Дальше фильтр «сложные», поиск по названию, затем перемешанный или обратный порядок. Результат кладётся в `textsViewEntriesCache`.
- Игры по папке: «Тест» (`openGameSetup('quiz')` → `startFolderQuiz`, нужно от двух материалов) и «Сопоставление» (`openGameSetup('matching')` → `startMatchingGame`, от четырёх).
- «В модуль» — `showTransferTermsModal` → `transferSelectedTermsToSubfolder`.
- «Выбрать материалы» → `textsSelectionMode` → «Скопировать выбранные».
- «Загрузить список» → `bulkImportModal` → `processBulkImport` (простые пары или формат переноса).
- Поиск: `filterTerms()` меняет `searchQuery`, перерисовывает и возвращает фокус и каретку в поле (`restoreTextsSearchFocus`), ведь экран пересобирается целиком.

### Форматы переноса (буфер обмена)

```
Название: CSAT                              ← материал (buildProcessedMaterialExport)
Описание:
1. {{Структурированное}} сообщение по {{единому::какой?}} шаблону

Папка: Нейросети                            ← папка (buildProcessedFolderExport)
Название: …   Описание: …                   ← «Название:» начинает новый материал
Модуль: Основы                              ← «Модуль:» начинает модуль
```

- `{{слово}}` — скрытое слово, `{{слово::вопрос}}` — с вопросом.
- Разбор: `parseProcessedDescriptionImport` (индексы по `split`), `parseCombinedMaterialImport`, `parseProcessedFolderImport`, `parseProcessedMaterialsImport`.
- Разбор терпим к испорченным по дороге переносам: `normalizeImportLineBreaks` приводит `\r\n`, `\r`, U+2028/U+2029 к `\n`; `parseImportTitleLine` понимает «Название: X Описание: текст» одной строкой (`IMPORT_TITLE_WITH_DESCRIPTION_RE`); «Описание:» с текстом после двоеточия (`IMPORT_DESCRIPTION_RE`) считается заголовком только сразу после названия — внутри описания такая строка остаётся текстом; если «Описание:» потеряли, описанием становится первая непустая строка после названия. `parseCombinedMaterialImport` берёт первый материал: следующее «Название:» заканчивает описание. Проверено по кругу «выгрузить → (испортить) → разобрать» на 24 000 случайных наборах: обычный вид, `\r\n`, U+2028 и «склеенный» — совпадение названий, текста, скрытых слов и вопросов.
- **Ограничение формата:** строка текста материала, которая начинается с «Название :», при разборе начнёт новый материал (так было и раньше).
- Вставка распознаётся сама в полях названия и описания (`handleTitleFieldPaste`, `handleDescriptionPaste`) и в названии папки (`handleFolderNamePaste`).
- **Формат не переносит** группы (`hiddenWordGroups`), сложные слова (`hardWords`), картинки, примеры и вопросы к термину.
- Кроме того, есть экспорт папки в JSON-файл (`shareFolder`) — со всеми полями, но обратного импорта нет.

#### Перенос флеш-карточек

```
Папка карточек: Английский     ← только у папки целиком (buildFlashcardFolderExport)
Описание: …                    ← если есть

Лицевая: Evidence              ← buildFlashcardsExport — каждая карточка
Оборотная:
многострочное значение
Сложная: да
Картинка: data:…
Источник: … / Ссылка: …
```

- Формат держится на ключевых словах (`FLASHCARD_EXPORT_KEYWORDS`), а не на пустых строках, поэтому без потерь переносит многострочные стороны с пустыми строками внутри, `attention`, `image`, `sourceLabel`, `sourceUrl`. Строка содержимого, начинающаяся с ключевого слова, при выгрузке получает `\` в начале (`escapeFlashcardExportLine`), при разборе теряет её (`unescapeFlashcardExportLine`). Регистр ключевых слов не важен.
- Разбор — `parseFlashcardExport` (признак — `isFlashcardExportText`: строка «Папка карточек:» или «Лицевая:»). Его зовёт `parseFlashcardBulkImport` первым делом, так что «Загрузить список карточек» принимает и перенос, и старый простой формат; `applyFlashcardImport` сохраняет все поля. Файл с переносом в окне не пересобирается в простой формат (иначе пропали бы отметки).
- Вставка папки целиком — в поле названия окна новой папки карточек: `handleFolderNamePaste` в режиме `card_root` кладёт разбор в `state.pendingFolderImport` с `kind: 'cards'`, `saveFolder` создаёт папку через `normalizeFlashcardFolder`.
- Проверено по кругу «выгрузить → разобрать» на 6 000 случайных наборах с каверзным содержимым — совпадение до символа.

### Флеш-карточки

- Данные: `flashcardFolders[].cards[]`. Пометка «сложная» (`attention`) — единственное, что сохраняется от изучения. Ставится звёздочкой в «Просмотре» (`toggleFlashcardAttention`) и в режиме «Карточки» — кнопкой «☆ Сложная» и клавишей `S` (`toggleCurrentFlashcardAttention`).
- Список «Карточки в папке» рисует `renderFlashcardListRows(folder)` по `getVisibleFlashcardIndexes` (порядок `W` + поиск). Поиск (`filterFlashcards`) пересобирает только `.flashcard-list`, не трогая поле. `W` и смена сторон — `renderRebuilt()`; смена сторон держит на месте верхнюю видимую карточку (`getFlashcardListAnchor` / `restoreFlashcardListAnchor`: после пересборки строки за экраном получают запасную высоту `contain-intrinsic-size`, и одна только прокрутка по числу сдвигала бы список). Выбор — `syncFlashcardSelectionDom()` без перерисовки.
- `swapFlashcardSides` (`E` в папке) меняет `front` и `back` у всех карточек папки прямо в данных и сохраняет — новая лицевая сторона действует во всех режимах и в переносе. `image` показывается на обеих сторонах, поэтому не трогается.
- Порядок без перемешивания — как в списке «Карточки в папке»: `getFlashcardOrder` разворачивает индексы, если включён `cardSortReversed` (`W`).
- «Только сложные»: `startFlashcardStudy(shuffle, onlyHard)` → `startFlashcardMode('flashcards', shuffle, onlyHard)` → `getFlashcardOrder(folder, shuffle, onlyHard)` берёт только карточки с `attention`. Флаг живёт в `flashcardStudyState.onlyHard`, его подхватывает `restartFlashcardStudy`; если сложных не осталось, запуск возвращает к папке, а не подсовывает всю колоду. Отметки по ходу занятия порядок (`order`) не меняют.
- Экран режима `flashcards`: переворот — тапом по карточке (`button.flashcard-study-card` → `flipFlashcard`), отдельной кнопки «Перевернуть» нет намеренно. На самой карточке только текст стороны и картинка — подписи `.flashcard-study-face-label` и подсказки `.flashcard-study-hint` в этом режиме убраны по просьбе пользователя (в «Строках», «Карточке» и «Вопросах» материалов они остались). Под карточкой «Назад» (`stepFlashcard(-1)`) и `.flashcard-next-btn` (`stepFlashcard(1)`) в ряду `.flashcard-nav-buttons` — он отодвинут от карточки на 30 px вместо общих 16, чтобы палец, целясь в «Дальше», не задевал карточку и не переворачивал её, в строке над ней — «☆ Сложная» и «✎ Изменить» (`showEditFlashcardModal(order[current])`, как `E`). «↺ Начать заново» — в шапке (`renderFlashcardModeToolbar`, только режим `flashcards`, не на экране завершения): `restartFlashcardFromStart` после `confirm` ставит `current = 0` в том же порядке и переносит `studyPosition` на первую карточку. В строку с «Сложная/Изменить» кнопка не влезает на 375–390 px — там она переносилась на вторую строку.
- Место в «Изучать»: `folder.studyPosition` — индекс карточки в `cards[]` (его сохраняет `normalizeFlashcardFolder`, иначе `flushSaveData` выбросил бы поле). Пишет `rememberFlashcardStudyPosition` при каждом шаге, но только ставит `hasPendingSaveData` — на диск попадает при ближайшем сохранении или уходе в фон, не на каждый тап. Действует только для прохода по порядку (`isResumableFlashcardStudy`: не перемешан, не «Только сложные»); `startFlashcardMode` начинает с `order.indexOf(studyPosition)`. «Завершить» удаляет поле, `deleteFlashcard` сдвигает его при удалении карточки выше.
- Номер значения в окне `flashcardModal`: каждое поле стороны обёрнуто в `.card-field` с кнопками `.card-mark-chip` (2)(3)(4). `toggleFlashcardNumberMark(fieldId, n)` ставит, заменяет или снимает `(n)` в конце поля (`FLASHCARD_NUMBER_MARK_RE`), `updateFlashcardMarkChips` подсвечивает текущий номер — зовут при открытии окна и на `input`. Кнопки не забирают фокус (`onmousedown` preventDefault), чтобы на iPhone не закрывалась клавиатура. Между полями — `.card-swap-row` (высота 0, круглая кнопка-иконка ⇅ без подписи висит на стыке полей) с `swapFlashcardModalSides()`: меняет значения полей и подсветку номеров, данные меняются только по «Сохранить». Окно материала (`textModal`) этого не имеет.
- Экран папки: панель `.flashcard-side-panel` «Сначала показывается» — пример `cards[0].front → back` и кнопка «⇅ Поменять» → `swapFlashcardSides()` (как `E`).
- Поиск в папке: `cardSearchQuery` (сброс в `openFlashcardFolder` и `goBackToFlashcardFolders`), `getVisibleFlashcardIndexes` — порядок `W` плюс фильтр по `front`/`back` (регистр и ё/е не важны). `filterFlashcards` перерисовывает только `.flashcard-list` через `renderFlashcardListRows`, не трогая поле, — иначе на iPhone терялись бы фокус и клавиатура. `selectAllFlashcards` и подпись «Выбрать все / Снять все» работают с видимыми карточками.
- Сеанс — `state.flashcardStudyState` (`getDefaultFlashcardStudyState`). `startFlashcardMode(mode)` выбирает режим: `flashcards`, `browse`, `learn`, `write`, `test`, `match`. Успехи по карточкам (`cardPerformance`: этап 0–3, верно и неверно) живут только в сеансе.
- `learn`: `prepareLearnPrompt` выбирает вид вопроса по этапу карточки — 0: выбор из вариантов, 1: «верно / неверно», 2–3: письменный ответ. Верный ответ поднимает этап (до 3 — «выучена»), ошибка опускает его и возвращает карточку в очередь второй по счёту.
- Таймер ответа: `armFlashcardTimer` / `syncFlashcardTimer` — `setTimeout` до границы следующей секунды; обновляет только сам счётчик. При сворачивании останавливается.
- Загрузка списка (`flashcardImportModal`): блоки «лицевая — первая строка, оборотная — остальные», между блоками пустая строка; без пустых строк — пары строк. Файлы: `.xlsx` и `.docx` распаковываются вручную (`readZipTextEntries` разбирает центральный каталог ZIP, `inflateZipEntry` — `DecompressionStream('deflate-raw')`), XML читает `DOMParser`; `.csv` — `csvToPlainText`. Строка-заголовок отбрасывается (`isFlashcardImportHeaderPair`).

### Курсы

- `courseFolders[].lessons[].tasks[]`; урок открыт, если пройден предыдущий (`isCourseLessonUnlocked` по `doneLessonIds`).
- Прохождение: `openCourseLesson` → теория (`handleTheoryContinue`) → задания (`submitCourseQuizChoice`, `confirmCourseQuizMulti`, `selectCourseMatchTerm/Def`) → `completeCourseLesson` (дописывает `doneLessonIds`, статистику).
- Редактор: `course_lesson_edit`, окна `courseLessonModal` и `courseTaskModal`. `normalizeCourseTask` выбрасывает неполные задания: тест — меньше двух вариантов или ни одного верного, сопоставление — меньше двух пар.

### Статистика, главная, профиль

- `recordStudyStats(mode, total, correct)` вызывают только тест по папке (`nextFolderQuizQuestion`), занятия с карточками (`completeFlashcardStudy`) и уроки курсов (`completeCourseLesson`). Практика, «Вписать», тест по одному материалу и «Сопоставление» в статистику не попадают. `buildStatsSummary()` считает серию дней, точность и последние семь дней — из этого собираются достижения (`getAchievementItems`).
- Профиль — локальные поля без сервера. «Связать с сайтом» (`linkAccountWithSite`) только ставит флаг.

---

## 10. Service worker (`sw.js`)

```
install:  caches.open(CACHE) → fillCache
            copyFontsFromOldCache — шрифты переносятся из любого старого кэша
            cache.addAll(APP_ASSETS, cache: 'no-cache') — index.html, fonts.css, manifest, иконки;
                                       всё обязательно, каждый файл сверяется с сервером
            Promise.allSettled(недостающие шрифты) — каждый по отдельности, ошибки не фатальны
          self.skipWaiting()
activate: удалить все кэши ≠ CACHE (в том числе 'zapominalka-voices' — нейроголоса до v138); clients.claim()
fetch:    caches.match(request) || fetch(request)        — «сначала кэш», без обновления в фоне
```

- **Обновление на телефоне.** Браузер сравнивает `sw.js` с прежним; изменился номер — ставится новый кэш, старый удаляется. Новая версия видна после **полного закрытия** приложения: запросы уже открытой страницы продолжают идти из старого кэша.
- **Без смены `CACHE` обновления нет вовсе** — главная причина жалоб «правка не появилась».
- Адрес с параметром (`index.html?v=3`) в кэше не найдётся и пойдёт в сеть — этим пользуются при проверке. Корень `./` тоже не в кэше: ярлык открывает `./index.html` (`start_url`), а адрес папки без интернета не откроется.
- **Файлы приложения при установке запрашиваются с `cache: 'no-cache'`.** GitHub Pages отдаёт их с `Cache-Control: max-age=600`, и обычный запрос в эти десять минут брал копию из HTTP-кэша браузера. Если две версии выходили подряд, новый кэш получал прошлый `index.html`, и правка не появлялась до следующей версии — это воспроизведено на копии приложения. Теперь каждый файл сверяется с сервером; неизменившийся сервер подтверждает ответом 304 без тела. Шрифты по-прежнему берутся обычным запросом: их содержимое не меняется никогда. **Не убирайте `cache: 'no-cache'`** при правке `fillCache`.
- Добавляете файл, без которого приложение не работает, — впишите его в `APP_ASSETS`.
- **Кэш `zapominalka-voices` удаляется.** До v138 в нём жили скачанные нейроголоса (по 60 МБ), и `activate` его не трогал. Теперь он удаляется вместе со старыми кэшами — место на телефоне освобождается при первом обновлении.

---

## 11. Зависимости

### Внешние

**Нет ни одной**: ни npm, ни CDN, ни шрифтов Google — шрифты лежат рядом. Работает в Safari на iOS (основная цель) и в настольных браузерах.

### Используемые возможности браузера

| API | Где и зачем | Если нет |
|---|---|---|
| `localStorage` | Все данные | Без него приложение не работает |
| Service Worker, Cache Storage | Офлайн | Работает онлайн как обычная страница |
| `requestIdleCallback` | Отложенная запись | `setTimeout(0)` (`scheduleIdleTask`) |
| `visualViewport` | Высота экранной клавиатуры в «Вписать» | Ограничения высоты нет |
| `DecompressionStream('deflate-raw')` | Распаковка .xlsx и .docx | Сообщение об ошибке чтения файла |
| `DOMParser` | XML внутри .xlsx и .docx | — |
| `FileReader` | Картинки в base64, текстовые файлы | — |
| `navigator.clipboard.writeText` | Копирование материалов | Запасной путь через `document.execCommand('copy')` в `copyPlainTextToClipboard` |
| `matchMedia` | Системная тема, `pointer: coarse` (`HAS_TOUCH_INPUT`) | — |
| `Blob`, `URL.createObjectURL` | Экспорт папки в JSON | — |
| `confirm`, `alert`, `prompt` | Подтверждение удаления, сообщения | — |
| `navigator.mediaDevices.getUserMedia`, `MediaRecorder` | Запись своего голоса ко всему тексту (`startAudioRecording`) | Плеер сообщает, что браузер не умеет записывать звук (на iPhone нужна iOS 14.3+) |
| IndexedDB | Хранение голосовых записей (`openAudioDb`) | Запись не сохранится — окно покажет ошибку |
| `HTMLAudioElement` | Воспроизведение, пауза, перемотка (`currentTime`) и скорость (`playbackRate`) в `audioPlayerEl`; пробник длительности | — |
| `OfflineAudioContext.decodeAudioData` | Поиск пауз для границ блоков (`findAudioPauses`) | Плеер сообщает, что разобрать звук не вышло; границы ставятся вручную или на слух |
| Pointer Events, `setPointerCapture` | Перемотка и перетаскивание границ на дорожке плеера | Остаются нажатие на блок, кнопки ±5 с, ±0,5 с и «Сюда» |
| `navigator.storage.persist` | Просьба не вычищать базу звука | Звук живёт по обычным правилам браузера |
| `<input type="file">`, `File.arrayBuffer` | Загрузка готового аудиофайла (`chooseAudioFile`, `onAudioFileChosen`) | Звук можно только записать с микрофона |

### Внутренние: на чём держится всё остальное

```
ensureTextStudyData ◄── почти любое обращение к материалу
getCurrentFolder ◄── getTopFolder ◄── state.currentFolder / currentSubfolder
content.split(/(\s+)/) ◄── все индексы: отрисовка, выбор, практика, «Вписать», перенос, ремонт
saveData ──► flushSaveData ──► normalize*Tree ──► localStorage
render ──► renderScreen ──► render*View ──► setAppHtml ──► patchChildNodes
getHiddenWordGroups / getHiddenWordGroupByIndex ◄── renderGroupsMemo (только внутри render)
escapeHtml / escapeHtmlAttr ◄── вся пользовательская строка в разметке
getStudyNavigationMeta / navigateToTerm ◄── studyQueue ◄── openText ◄── textsViewEntriesCache ◄── renderTextsView
```

Цепочки, которые проще всего порвать:

- `renderTextsView` → `textsViewEntriesCache` → `openText(vi)`, свайп, перетаскивание, `toggleAttention(vi)`, выбор материалов. Индекс `vi` относится к **видимому** списку, а не к массиву папки.
- `getRenderableHiddenIndices` зависит от `state.view`, `state.mode` и `state.practiceMode`: в режиме вопросов участники группы скрыты за ведущим словом.
- `typeWordMatches` ← `normalizeTypeWord` ← `convertKeyboardLayout`: меняя нормализацию, проверьте обе раскладки.

---

## 12. Рецепты изменений

**Новый режим изучения материала**

1. Значение для `state.mode`; ветка в диспетчере `renderPracticeView` (≈12418) с функцией `renderXxxView(text)`.
2. Подготовка в трёх местах: `setMode`, `openTermInMode`, `navigateToTerm` — для сброса флагов вроде `xxxFlipped`.
3. Кнопка во **всех девяти** панелях режимов и карточка на экране выбора (`renderChooserView`).
4. По желанию — цифра в `switchStudyModeByHotkey` и описание в README.

**Новое поле материала** — `ensureTextStudyData`. Если в нём индексы слов — ещё перенос в `remapProcessedTextState`, `repairWordIndexAlignment`, `applyPunctuationSplitToText`. Если оно должно переживать копирование — формат переноса.

**Новый экран** — ветка в `renderScreen`, функция перехода, которая ставит `state.view` и сбрасывает лишнее, и вход в `handleEscapeAction` для возврата назад.

**Новая клавиша** — в главный диспетчер с учётом порядка из §8. Проверьте обе раскладки и то, что клавиша не перехватывается раньше, когда курсор в поле ввода.

**Новое окно** — разметка в `<body>` рядом с остальными (`.modal`), открытие через `classList.add('show')`, закрытие в `handleEscapeAction`, если нужно особое поведение.

**Любая правка `index.html`** — поднять `CACHE` в `sw.js`, обновить README (и CLAUDE.md или этот файл, если менялось устройство), закоммитить и отправить.

---

## 13. Мёртвый код и наследие

Удалять не обязательно, но опираться на это нельзя.

| Что | Почему мёртвое |
|---|---|
| `checkAuth`, `authUser`, `sharedToken`, `serverVersion` | Остатки серверной версии; сервера нет |
| `importSharedFolder`, `linkAccountWithSite`, экран `shared` | Заглушки: кнопки есть, но первая только показывает сообщение, а вторая ставит флаг в профиле |
| Ветки `keys` и `keys_edit` в `renderScreen` и `openTermInMode`, поле `semanticKeys` в старых данных | Остатки смысловых ключей: оба значения ведут на выбор режима, поле не читается |
| `text.hintTypes` | Пишется, не читается |
| `state.practiceMode === 'combined'` | Устаревшее значение; превращается в `default` |

**Удалено 2026-10-15** (около 330 строк, ничего не вызывало): смысловые ключи целиком — `renderSemanticKeysEditView`, `renderSemanticKeysView`, `createSemanticKey`, `toggleSemanticKey`, `revealNextSemanticKey`, `revealAllKeys`, `hideAllSemanticKeys`, `saveCurrentSelection`, `openSemanticKeysEdit/View`, `state.revealedKeys`, стили `.semantic-*`; а также `syncToServer`, `loadStats`, `renderLandingView`, `goToPractice`, `setPracticeMode`, `revealWordFully`, `showAllWords`, `nextQuizQuestion`, `deleteText`, `isHardWord`. Проверка неиспользуемых функций: скрипт из CLAUDE.md, «Мёртвый код».

---

## 14. Известные риски и долги

- **Не везде экранирование.** `${text.title}` вставляется в разметку как есть в `renderTextsView`, `renderChooserView` и `getTermNavHeader`, `${text.example}` — в `renderExampleView`. Данные свои, но угловая скобка в названии сломает вёрстку. Кроме того, `escapeHtml` не экранирует кавычки — для атрибутов есть `escapeHtmlAttr`.
- **Картинки в `localStorage`.** Около 5 МБ на всё; если станет тесно — переносить картинки в IndexedDB.
- **Дублирование стилей** — 19 селекторов объявлены дважды (§3).
- **Панель режимов в девяти копиях**, и они уже разошлись (§6).
- **Устаревшие комментарии.** Например, у `getTokenLineNumbers` написано «те же номера», хотя номеров на чипах больше нет. Комментарий — подсказка, а не истина; сверяйтесь с кодом.
- **Плеер озвучки на настоящем iPhone не проверялся.** В браузере Claude (ширина 390 и 375) проверены: игра, пауза, ±5 с, блоки вперёд-назад, перемотка нажатием и ведением по дорожке, переход по блоку из списка, продолжение с запомненного места, конец звука, закрытие при игре и на паузе, v141: окна «Озвучка» и кнопок «🔊 N» нет, карточка «Озвучка» и кнопка в шапке открывают плеер; без звука — загрузка файла (и «не звук» — сообщение, звук не тронут), запись с подменённым микрофоном (панель записи, «Стоп» сохраняет, закрытие плеера посреди записи сохраняет и выключает микрофон, отказ в микрофоне — сообщение), замена и удаление звука, звук к пунктам — «Пункты по порядку» и удаление; скорость (v140: список открывается, выбор меняет скорость и посреди игры — на 0,75× за 2 с проходит 1,5 с записи, нажатие мимо закрывает список и срабатывает само, `Escape` сперва закрывает список, слушатель на документе снимается при любом закрытии, список целиком виден в окне), перетаскивание границ и отмена жеста, ±0,5 с, «Сюда», разметка на слух и её отмена, поиск пауз (на озвучке «Милены» с паузами 0,9 с — границы за 0,15–0,2 с до первого слова), сохранение после перезагрузки, клавиши, материал из одной строки, звук только к пунктам. Не проверены: перетаскивание пальцем на iOS (`touch-action: pan-y`, `pointercancel`), перемотка до первого `play()` в Safari, `decodeAudioData` и память на длинном MP3 на iPhone, звук после закрытия плеера при выключенном экране.
- **Загрузка аудиофайла на настоящем iPhone не проверялась.** В браузере Claude проверены выбор файла (подменой `input.files`), отказ на «не звук», звук ко всему тексту и к пунктам, «Слушать весь текст», «Номера», удаление вместе с материалом. Не проверены: какой выбор показывает iPhone на `accept="audio/*,…"` (ожидаются «Файлы»), читает ли Safari длительность до нажатия «Слушать» (если нет — файл примется без длительности) и как ведут себя большие файлы.
- **Тестов нет.** Проверка — в браузере (CLAUDE.md, «Как проверять ускорения» и «Проверка правок»).

---

## Как быстро сориентироваться

```bash
# Все функции с номерами строк
grep -n -E "^        (async )?function " index.html

# Где определена и откуда вызывается функция (с вызовами из onclick в разметке)
grep -n "renderTypeView" index.html

# Все глобальные слушатели
grep -n "addEventListener(" index.html

# Текущая версия кэша
head -1 sw.js
```

Порядок чтения для новой задачи: CLAUDE.md (правила и ловушки) → нужный раздел этого файла → сама функция в `index.html` → раздел README о поведении для пользователя.
