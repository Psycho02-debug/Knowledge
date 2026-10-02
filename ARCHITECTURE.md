# Архитектура «Запоминалки» — карта для правки кода

Справочник для того, кто открывает проект без истории переписки: где что лежит, как данные текут от касания до диска и экрана, кто от кого зависит. Здесь описано, **как устроено**. Где ошибались раньше и что нельзя ломать, собрано в [CLAUDE.md](CLAUDE.md). Что умеет приложение с точки зрения пользователя, описано в [README.md](README.md).

Номера строк ниже приблизительные: файл правится постоянно, и они сдвигаются. Ищите по имени — `grep -n "function имя(" index.html`. Свежую карту всех функций с номерами строк даёт команда из раздела [«Как быстро сориентироваться»](#как-быстро-сориентироваться).

Сверено с кодом: версия кэша `zapominalka-v96`, `index.html` — 17 312 строк, 818 КБ.

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
| 13–5999 | `<style>` — все стили, около 6 тысяч строк |
| 6001–6097 | `<div id="app">` — **устаревший снимок** экрана папок, сохранённый когда-то вместе с файлом. Первый же `render()` заменяет его целиком, поэтому правки там ничего не дают. В нём встречаются `shareFolder(0)`…`shareFolder(3)` — это не настоящие вызовы |
| 6098–6380 | Тринадцать модальных окон статичной разметкой (список в §8) |
| 6381–17302 | Основной `<script>` |
| 17305–17311 | Регистрация service worker по событию `load` |

### Стили

- `:root` (≈14) — палитра «тёмная оливковая», переменные `--bg-*`, `--text-*`, `--accent-*`, `--gradient-*`, `--shadow-*`.
- `body.dark-theme` (≈63) — вторая палитра, ещё глубже. Светлой темы нет: обе тёмные.
- `@media (prefers-reduced-motion: reduce)` (≈307) — гасит анимации.
- `.no-entry-anim` (≈315) — выключает анимации появления при обновлении того же экрана.
- Чипы слов: `.word`, `.word.hidden-word`, `.has-letters`, `.has-custom-hint`, `.hard-word`, `.practice-focus-active`, `.next-reveal` и затухание соседей — ≈1261–1560.
- Альбомная ориентация: `@media (orientation: landscape) and (max-height: 560px)` (≈1159, ≈1640).
- Режим «Вписать» — ≈2562–2860, карточка термина — ≈4797, курсы — ≈5719 (`/* ===== COURSES ===== */`).
- Узкие экраны — `@media (max-width: 860px)` и `(max-width: 480px)` (≈5602).

> **Ловушка: селекторы повторяются.** Девятнадцать селекторов верхнего уровня объявлены дважды. Например, блок `/* Type mode styles */` скопирован целиком (≈2562 и ≈2864): `.type-input-wrap`, `.type-input-field` и соседние. При одинаковой специфичности побеждает последнее объявление. Перед правкой стиля найдите **все** вхождения селектора.

### Основной скрипт по областям

Порядок в файле — исторический, а не логический. Таблица идёт сверху вниз.

| Строки (≈) | Область | Ключевые функции |
|---|---|---|
| 6382–6440 | Глобальные переменные списка, тема, размер текста | `toggleTheme`, `loadTheme`, `loadPracticeTextScale`, `getTermCountText` |
| 6441–6545 | Форма материала, группы скрытых слов | `ensureTextStudyData`, `getHiddenWordGroups`, `computeHiddenWordGroups`, `getHiddenWordGroupByIndex`, `renderGroupsMemo` |
| 6546–6870 | Классификация токенов, отделение знаков препинания, ремонт индексов | `isPunctuationToken`, `isNumericListMarkerToken`, `isSlashSeparatorToken`, `splitEdgePunctuation`, `splitEdgeToken`, `repairWordIndexAlignment`, `applyPunctuationSplitToText`, `normalizeAllMaterialsPunctuation` |
| 6870–7180 | Перенос разметки при правке текста, объединение слов в вопросах | `buildContentWordIndexMap`, `remapProcessedTextState`, `updateMaterialContentPreservingProcessing`, `getRenderableHiddenIndices`, `buildBatchHintUnits`, `mergeBatchHintWithNext` |
| 7180–7290 | Поиск, сортировка, склонения | `filterTerms`, `clearSearch`, `toggleSort`, `getAllMaterialEntries`, `getCardCountText` |
| 7288–7500 | Нормализация карточек и курсов, встроенный набор карточек | `normalizeFlashcardCard/Folder/FoldersTree`, `normalizeCourseTask/Lesson/Folder/FoldersTree`, `getBuiltInFlashcardFolders`, `ensureBuiltInFlashcardFolders` |
| 7501–7665 | Значения по умолчанию, иконки, профиль | `getDefaultFlashcardSessionConfig`, `getDefaultFlashcardStudyState`, `getDefaultCourseStudyState`, `getDefaultProfile`, `getLocalProfile`, `saveProfile` |
| 7667–7760 | Очередь изучения: порядок перехода между материалами | `setStudyQueueFromVisibleEntries`, `getStudyNavigationMeta`, `getStudyNavigationTarget`, `applyStudyNavigationTarget` |
| 7766–7868 | **`state`** и переменные отложенной записи | `state`, `lastSavedData`, `renderQueuedWhileHidden`, `lastRenderSignature`, `HAS_TOUCH_INPUT` |
| 7870–8065 | Хранение и запуск, слушатели жизненного цикла | `scheduleIdleTask`, `flushSaveData`, `flushLocalStats`, `flushPendingPersistence`, `getLocalData`, `loadData`, `openStartupFolder`, `saveData` |
| 8067–8180 | Дерево папок, записи списка материалов | `ensureFolderShape`, `normalizeFoldersTree`, `getTopFolder`, `getCurrentFolder`, `getCurrentFolderTitle`, `buildTextsViewEntries`, `getTextLocationFromListIndex`, `shuffleVisibleTexts` |
| 8180–8380 | Статистика, мелкие помощники | `getLocalStats`, `saveLocalStats`, `buildStatsSummary`, `getFirstLettersOnly`, `getMaxHintLetters`, `shuffleArray`, `initGame`, `initQuiz` |
| 8384–8593 | **Конвейер отрисовки** | `syncElementAttributes`, `patchChildNodes`, `setAppHtml`, `render`, `renderScreen`, `syncDockSpacing` |
| 8594–9174 | Режим «Вписать» | `renderTypeView`, `normalizeTypeWord`, `convertKeyboardLayout`, `typeWordMatches`, `getTypeSequenceTokens`, `evaluateTypedWords`, `checkTypeWord`, `focusTypeField`, `syncTypeTextClamp`, `toggleTypeFocusLine`, а также `compactMarkup` и `getTermCardEntryDelay` |
| 9175–9408 | Смена режима, свайп и перетаскивание карточек, пометка сложных материалов | `setMode`, `initTermCardSwipe`, `initDragReorder`, `toggleAttention`, `resetAllAttention`, `toggleDifficultFilter` |
| 9409–9540 | Главная навигация и нижняя панель вкладок | `setPrimaryView`, `handlePrimaryCreateAction`, `openLearningBranch`, `renderBottomNav`, `renderShell` |
| 9541–10041 | Главная, «База знаний», хаб обучения, папки карточек | `renderHomeView`, `renderSharedView`, `renderLearningHubView`, `renderFlashcardFoldersView`, `renderFlashcardFolderView` |
| 10042–10812 | Курсы: действия, экраны, окна | `openCourseLesson`, `submitCourseQuizChoice`, `selectCourseMatchTerm`, `renderCourseFoldersView`, `renderCourseFolderView`, `renderCourseLessonEditView`, `renderCourseLessonView`, `saveCourseLesson`, `saveCourseTask` |
| 10813–11162 | Экраны изучения карточек | `renderFlashcardStudyView` и `renderFlashcard{Learn,Write,Test,Match,Browse}Body` |
| 11163–11370 | Статистика, экспорт папки в JSON, список папок, профиль | `renderStatsView`, `shareFolder`, `renderFoldersView`, `renderProfileView` |
| 11371–11585 | **Экран «Материалы»** (список материалов папки) | `renderTextsView` |
| 11586–11704 | Экран материала (выбор режима), шапка термина | `renderChooserView`, `navigateChooser`, `getTermNavHeader` |
| 11705–11970 | Фокус в практике, сложные слова | `getPracticeFocusTargets`, `getPracticeFocusSpan`, `advancePracticeFocus`, `focusNextPracticeWord`, `toggleHardWord`, `startHardPress`, `renderPracticeHiddenWord` |
| 11971–12308 | **Практика и выбор слов** | `renderPracticeView`: режимы `edit` и `practice`, а для остальных — диспетчер |
| 12309–12684 | Пример, карточки по строкам, карточка термина, вопросы к термину | `renderExampleView`, `buildLineCards`, `renderLineCardsView`, `formatContentForReading`, `renderTermCardView`, `renderQuestionsView`, `saveQuestionEntry` |
| 12685–12972 | «Собери текст», тест по материалу, тест по папке | `renderGameView`, `renderQuizView`, `selectQuizOption`, `renderFolderQuizView` |
| 12973–13316 | Окно запуска игр, перенос материалов в модуль, логика теста по папке | `openGameSetup`, `startGameWithSelected`, `showTransferTermsModal`, `transferSelectedTermsToSubfolder`, `startFolderQuiz` |
| 13317–13580 | Запись статистики, «Сопоставление», правка и удаление материала из списка, ход в «Собери текст» | `recordStudyStats`, `startMatchingGame`, `renderMatchingView`, `editTerm`, `deleteTerm`, `selectWord` |
| 13581–14398 | Открытие папок, карточки: действия и движок изучения | `openFolder`, `openFlashcardFolder`, `startFlashcardMode`, `prepareLearnPrompt`, `advanceLearnPrompt`, `armFlashcardTimer`, `syncFlashcardTimer`, `resolveFlashcardMatchAttempt` |
| 14399–14574 | Навигация по текстам | `openSubfolder`, `openText`, `openTermInMode`, `switchStudyModeByHotkey`, `goBack`, `goBackToTexts`, `goBackToChooser` |
| 14575–14802 | Смысловые ключи — **мёртвый код** (§13) | `createSemanticKey`, `renderSemanticKeysView`… |
| 14803–14856 | Экранирование, переход между материалами | `escapeHtml`, `escapeHtmlAttr`, `navigateToTerm` |
| 14857–14943 | Поле описания: автонумерация списков | `handleDescriptionFocus`, `insertNextListNumber`, `renumberListBelow`, `handleDescriptionBeforeInput` |
| 14944–15305 | Форматы переноса, выбор материалов, копирование | `buildProcessedDescriptionExport`, `buildProcessedFolderExport`, `parseProcessedFolderImport`, `parseProcessedDescriptionImport`, `parseCombinedMaterialImport`, `copyPlainTextToClipboard`, `toggleTextSelection`, `copySelectedMaterials` |
| 15306–15587 | Вставка в поля, открытие окон, картинки | `handleTitleFieldPaste`, `handleDescriptionPaste`, `handleFolderNamePaste`, `showFolderModal`, `showTextModal`, `handleImageUpload` |
| 15588–16006 | Загрузка списка карточек: текст, .xlsx, .docx, .csv | `FLASHCARD_IMPORT_TEMPLATE`, `parseFlashcardBulkImport`, `readZipTextEntries`, `inflateZipEntry`, `xlsxToPlainText`, `docxToPlainText`, `csvToPlainText`, `applyFlashcardImport` |
| 16007–16206 | Закрытие окон, Escape, Cmd+Shift в окне материала | `closeModal`, `handleEscapeAction`, `saveTextAndSelectWords`, `runModalShortcut` |
| 16207–16464 | Сохранение из окон, загрузка списка материалов, порядок и удаление папок | `saveFolder`, `saveFlashcard`, `saveText`, `processBulkImport`, `moveFolder`, `deleteFolder` |
| 16465–16745 | Выбор слов: отметка, скрытие, вопросы к словам | `toggleMark`, `applyBatchHide`, `selectAllPendingWords`, `showBatchHintModal`, `saveCurrentWordHint`, `finishBatchHint`, `saveHint` |
| 16746–17002 | Практика: раскрытие и подсказки | `getActivePracticeTargetIndex`, `revealNextHintLetter`, `revealWord`, `revealNextWord`, `toggleAllWordsReveal`, `resetReveal`, `setPracticeTextScale`, `clearMarks` |
| 17003–17302 | Запуск: тема и масштаб, **диспетчер клавиатуры**, `loadData()` | безымянный обработчик `keydown` |

---

## 4. Состояние

### Глобальный объект `state` (≈7769)

Объявлен через `let`, поэтому в `window` не попадает: из консоли он доступен, а из соседнего `iframe` — только как `frame.contentWindow.eval('state')`.

**Навигация**

| Поле | Значения и смысл |
|---|---|
| `view` | Открытый экран — список в §6 |
| `mode` | Режим внутри материала: `edit`, `practice`, `type`, `game`, `quiz`, `linecards`, `questions`, `termcard`, `example`; `null` — на экране выбора режима (`term_chooser`) |
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
| `typeState` | `{ currentIndex, solved[], wrongWords[], value, answered, isCorrect, singleWrongWord }`. Создаётся `resetTypeState()`; начальное значение в объявлении `state` неполное — без `solved` и `wrongWords`, поэтому чтение идёт через `getSolvedTypeWords()` |
| `typeFocusLineEnabled` | Фокус на строке в «Вписать» |
| `lineCardFlipped`, `lineCardCueMode` (`letter` или `word`), `termCardFlipped`, `questionsCardFlipped` | Стороны карточек |
| `gameState`, `quizState` | «Собери текст» и тест по материалу |
| `folderQuizMode`, `matchingMode`, `matchingState` | Игры по папке. Пока флаг поднят, `renderTextsView` рисует игру вместо списка |
| `editingText`, `editingTermIndex`, `editingTermSubfolder`, `editingQuestionIndex` | Что именно правит открытое окно |
| `pendingDescriptionImport`, `pendingFolderImport` | Разобранный перенос, ждущий сохранения окна |
| `textsSelectionMode`, `selectedTextKeys` | Режим «Выбрать материалы». Ключи вида `root:3` или `subfolder-1:0` |
| `showDifficultOnly` | Фильтр «только сложные» в списке |
| `folderModalMode` | Для чего открыто общее окно папки: `root`, `subfolder`, `card_root`, `course_root` |
| `revealedKeys` | Остаток смысловых ключей (§13) |

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
| `textsViewEntriesCache` | **Видимый список материалов** — его заполняет `renderTextsView()`. По индексу в нём работают `openText(vi)`, свайп, перетаскивание и выбор. Отрисовка здесь не чистая: она пишет кэш, от которого зависят действия |
| `shuffledTextEntryKeys`, `shuffledTextEntryScope` | Перемешанный порядок и для какой папки он действует |
| `quizFocusedOption` | Вариант, выбранный стрелками в тесте |
| `renderGroupsMemo` | Память групп скрытых слов на время одной отрисовки (CLAUDE.md) |
| `lastRenderSignature` | `view + '|' + mode` прошлой отрисовки: тот же экран или новый |
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

Других хранилищ нет: ни IndexedDB, ни cookies, ни `sessionStorage`. Браузер даёт около 5 МБ на всё. Самое объёмное — картинки в base64 внутри материалов и карточек.

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
| `revealedWords` | `number[]` | Открытые сейчас. Сохраняются на диск, но сбрасываются при каждом входе в материал и при переходе между материалами — фактически это состояние сеанса |
| `halfRevealedWords` | `number[]` | Слова с живой подсказкой; сбрасываются там же |
| `hintLetters` | `{индекс: число}` | Сколько букв открыто подсказкой. Читается только для слов из `halfRevealedWords`, поэтому старые записи не чистятся |
| `hardWords` | `number[]` | Слова, отмеченные сложными (красные чипы) |
| `wordHints` | `{индекс: строка}` | Свои вопросы к словам; пустая строка — вопроса нет |
| `hiddenWordGroups` | `{ведущий: number[]}` | Несколько соседних скрытых слов под одной плашкой; ключ — индекс первого слова |
| `hintTypes` | `{индекс: 'default'}` | **Мёртвое поле:** пишется, но нигде не читается |
| `questions` | `string[]` | Вопросы к термину целиком (режим «Вопросы») |
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
                                                                          ├─ JSON.stringify
                                                                          └─ если ≠ lastSavedData → localStorage.setItem
saveData(true)              — записать сразу
flushPendingPersistence()   — сбросить всё ожидающее (visibilitychange→hidden, pagehide, beforeunload)
```

Не каждое действие вызывает `saveData()`: раскрытие слова (`revealWord`, `revealNextWord`) меняет `revealedWords` без записи — эти поля всё равно обнуляются при следующем входе.

### Запуск: `loadData()` (≈7950)

```
loadTheme(); loadPracticeTextScale()             — ещё до данных, внизу скрипта
loadData():
  getLocalData()                                 — разбор wordMemorizer; при ошибке пусто
  normalizeFlashcardFoldersTree / normalizeCourseFoldersTree
  getLocalProfile()
  normalizeFoldersTree(state.folders)            — у каждой папки есть texts и subfolders
  normalizeAllMaterialsPunctuation()             — отделение знаков + ремонт индексов у всех материалов
  ensureBuiltInFlashcardFolders()                — подкладывает набор «NASA · Планеты», если папки с таким именем нет
  если что-то изменилось → saveData(true)
  state.view = 'home'
  openStartupFolder() || render()                — сразу открыть папку «Термины» (STARTUP_FOLDER_NAME)
```

Встроенный набор карточек ищется по имени. Удалите его — при следующем запуске он появится снова, а переименуйте — к нему добавится ещё один.

---

## 6. Экраны и переходы

`state.view` выбирает функцию отрисовки в `renderScreen()` (≈8490):

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
| `questions` | «Вопросы к термину» | `renderQuestionsView` | `questionsCardFlipped = false` |
| `termcard` | «Карточка»: название ↔ весь текст | `renderTermCardView` | `termCardFlipped = false` |
| `example` | «Пример» | `renderExampleView` | — |

**Панель режимов скопирована восемь раз** — в `renderTypeView`, `renderExampleView`, `renderLineCardsView`, `renderTermCardView`, `renderQuestionsView`, `renderQuizView` и дважды в `renderGameView`: в игре и на экране её завершения. У каждой копии свой `active`. Кнопки — `.mode-btn` с `onclick="setMode('…')"`; подписи: Выбор, Практика, Вписать, Игра, Тест, Строки, Вопросы, Карточка, Пример.

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
     ├─ canPatchDom = тот же экран и view ≠ 'texts'
     ├─ html = renderXxxView()            — строка
     ├─ setAppHtml(#app, html, canPatchDom)
     │     нельзя патчить → innerHTML
     │     можно → <template>.innerHTML = html → patchChildNodes(app, template.content)
     │                 разное число детей → innerHTML этого поддерева
     │                 другой тег или тип узла → replaceChild(clone)
     │                 текст или комментарий → nodeValue
     │                 чип слова (data-widx) с тем же class, data-widx и текстом → пропуск
     │                 иначе → syncElementAttributes (и value у полей) + рекурсия
     │     исключение → innerHTML (запасной путь)
     ├─ после: texts → initTermCardSwipe() (только сенсорный экран) и initDragReorder()
     ├─ syncFlashcardTimer(), syncDockSpacing()
     ├─ вернуть прокрутку, если это тот же экран
     └─ type → syncTypeTextClamp()        — строго после прокрутки
 finally: renderGroupsMemo = null
```

Следствия, на которые опирается код:

- **Экран «Материалы» всегда пересобирается целиком.** После отрисовки он навешивает слушатели на узлы, а при патче они навесились бы повторно.
- **Поля ввода переживают перерисовку**, если поддерево не пересобиралось. Поэтому условные блоки рядом с полями не вставляют, а прячут классом (CLAUDE.md).
- **CSS-переходы срабатывают при патче**: узел остаётся тем же, и у него есть прежнее значение, от которого можно анимировать.
- **Отрисовка не совсем чистая.** `renderTextsView` пишет `textsViewEntriesCache`, а при пропавшей папке меняет `view` и вызывает `render()`. `renderPracticeView` переносит `practiceFocusWordIndex`, если слово исчезло после правки текста. Менять разметку скрытия (`hiddenWords`, `hiddenWordGroups`) внутри отрисовки нельзя из-за `renderGroupsMemo`.
- `compactMarkup(html)` убирает пробелы между тегами в списках материалов и карточек — только там, где контейнеры flex (CLAUDE.md).
- `getTermCardEntryDelay(i)` ограничивает каскад появления карточек восемью шагами по 0.05 с.

### Анатомия чипа слова (практика)

```html
<span class="word hidden-word [has-letters|has-custom-hint] [hard-word]
             [practice-focus-active] [next-reveal]"
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
| 8036 | `document` `visibilitychange` | Сворачивание: остановить таймер карточек и сбросить запись. Возврат: выполнить отложенную отрисовку |
| 8052–8053 | `window` `pagehide`, `beforeunload` | `flushPendingPersistence` |
| 8059 | `window` `resize` | `syncDockSpacing` не чаще раза за кадр |
| 9130 | `visualViewport` `resize` | В «Вписать» — подстроить высоту текста под экранную клавиатуру |
| 11936–11942 | `document` touch- и mouse-события | Долгое нажатие (480 мс) — отметить слово сложным |
| 11944 | `document` `click` (захват) | Погасить клик после сработавшего долгого нажатия |
| 11951 | `document` `contextmenu` | Правая кнопка мыши — отметить слово сложным |
| 14612 | `document` `selectionchange` | Смысловые ключи (мёртвое; без их поля ничего не делает) |
| 16186–16205 | `keydown` и `keyup` (захват), `mousedown`, `blur` | Cmd+Shift в окне материала: сохранить и выделить слова |
| 17006 | `document` `keydown` | **Главный диспетчер клавиатуры** |

3. **После каждой отрисовки экрана «Материалы»** — `initTermCardSwipe()` (свайп вправо — сложный, влево — снять пометку) и `initDragReorder()` (перетаскивание за ручку). Это единственное исключение из правила «не навешивать слушатели после render» — и причина, по которой этот экран не патчится.

### Диспетчер клавиатуры (≈17006): порядок проверок

Первое сработавшее правило завершает обработку. Новую клавишу вставляйте с учётом этого порядка.

1. Открыто окно вопросов (`batchHintModal`) — `,` `.` `б` `ю` игнорируются.
2. `Escape` → `handleEscapeAction()`: закрыть окно или вернуться назад.
3. «Вписать» завершено, `Enter` пришёл не из поля → следующий материал.
4. Из поля `#typeInputField`: `↓` → фокус на строке; `←` `→` без модификаторов → соседний материал.
5. Фокус в любом другом `INPUT` или `TEXTAREA` → **дальше не идём**.
6. `Cmd/Ctrl+C` → «Скопировать материал» (выбор слов) или «Скопировать выбранные» (список в режиме выбора).
7. `Ctrl` без `Cmd` → выход.
8. Выбор слов: `1` — скрыть выделенное, `2` — скрыть через вопросы (только если что-то выделено; иначе `1`–`4` здесь молчат). `5` и `6` — «Вписать».
9. `1`–`6` на экране материала, в «Вписать» и в практике → `switchStudyModeByHotkey`.
10. Выбор слов: `/` — выделить все, `.` — следующее слово.
11. Список материалов: `N` — режим выбора, `W` — сортировка, `S` — перемешать.
12. Внутри материала: `E` — правка.
13. `]` или `` ` `` — создать (на списках) или править (внутри материала).
14. Тест (материала или папки): `↑` `↓` `Enter`.
15. «Вписать»: `↓` — фокус на строке.
16. Практика: `Delete`/`Backspace` — выключить фокус, `↓` — фокус дальше, `Shift` — ещё букву, `↑` — открыть или скрыть все, `M` — сложное слово.
17. Нужен открытый материал: `←` `→` — соседний (на экране выбора — `navigateChooser`), `R` — скрыть всё снова (практика), `S` — сложный материал, `Пробел` — открыть следующее слово.

Буквы сверяются по `e.key` сразу в обеих раскладках: `e`/`у`, `m`/`м`/`ь`, `n`/`н`/`т`. `Cmd+C` — по `e.code`.

### Модальные окна

Открытое окно — `.modal.show`, закрывает `closeModal(id)`. Окна статичны, лежат в `<body>` вне `#app` и при `render()` не пересоздаются:

`folderModal` (папка, модуль, папка карточек, курс — одно окно на всех), `questionModal`, `learningCreateModal`, `textModal`, `bulkImportModal`, `flashcardModal`, `flashcardImportModal`, `courseLessonModal`, `courseTaskModal`, `gameSetupModal`, `transferTermsModal`, `hintModal`, `batchHintModal`.

Окно открывает функция вида `showXxxModal()`: она заполняет поля и ставит фокус через `setTimeout(…, 100)`. Сохраняет `saveXxx()`: читает поля, меняет данные, затем `saveData()`, `closeModal()` и `render()`.

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

### Тексты: практика (`mode = 'practice'`)

- **Следующее слово** — `getActivePracticeTargetIndex()`: первое не открытое из `getRenderableHiddenIndices()`, где в режиме `hints` у группы остаётся только ведущее слово. В фокусе — скрытое слово под ним.
- **Раскрытие**: `revealNextWord()` (кнопка и `Пробел`), `revealWord(i)` (клик по чипу), `toggleAllWordsReveal()` (`↑`), `resetReveal()` (`R`), `hideWordAgain(i)` (клик по открытому).
- **Подсказка по буквам**: `revealNextHintLetter()` (кнопка и `Shift`) добавляет слово в `halfRevealedWords` и увеличивает `hintLetters[i]`. Предел — `getMaxHintLetters(word)`: число букв и цифр минус одна, так что последняя буква не открывается никогда. `getVisibleHintLetters` учитывает первую букву режима `firstletter`.
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
- Завершение — то же `.type-card` с полным текстом. `Enter` на нём ведёт к следующему материалу (диспетчер, пункт 3).

### Тексты: остальные режимы

- `game` — `initGame()` перемешивает слова в `gameState.scrambledWords`; `selectWord`, `removeFromResult`, `restartGame`.
- `quiz` — `initQuiz()` берёт описания до трёх других материалов той же папки как неверные варианты (нужно минимум два материала); `selectQuizOption`, `restartQuiz`.
- `linecards` — `buildLineCards()` по строкам (`getTextManualLines`), подсказка — первая буква или первое слово (`lineCardCueMode`).
- `termcard` — `renderTermCardView`: лицевая сторона — `title`, оборотная — `formatContentForReading(content)`, где знаки снова прилеплены к словам. Ничего не хранит.
- `questions` — `text.questions`, окно `questionModal`.
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
- Вставка распознаётся сама в полях названия и описания (`handleTitleFieldPaste`, `handleDescriptionPaste`) и в названии папки (`handleFolderNamePaste`).
- **Формат не переносит** группы (`hiddenWordGroups`), сложные слова (`hardWords`), картинки, примеры и вопросы к термину.
- Кроме того, есть экспорт папки в JSON-файл (`shareFolder`) — со всеми полями, но обратного импорта нет.

### Флеш-карточки

- Данные: `flashcardFolders[].cards[]`. Пометка «сложная» (`attention`) — единственное, что сохраняется от изучения.
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
activate: удалить все кэши ≠ CACHE; clients.claim()
fetch:    caches.match(request) || fetch(request)        — «сначала кэш», без обновления в фоне
```

- **Обновление на телефоне.** Браузер сравнивает `sw.js` с прежним; изменился номер — ставится новый кэш, старый удаляется. Новая версия видна после **полного закрытия** приложения: запросы уже открытой страницы продолжают идти из старого кэша.
- **Без смены `CACHE` обновления нет вовсе** — главная причина жалоб «правка не появилась».
- Адрес с параметром (`index.html?v=3`) в кэше не найдётся и пойдёт в сеть — этим пользуются при проверке. Корень `./` тоже не в кэше: ярлык открывает `./index.html` (`start_url`), а адрес папки без интернета не откроется.
- **Файлы приложения при установке запрашиваются с `cache: 'no-cache'`.** GitHub Pages отдаёт их с `Cache-Control: max-age=600`, и обычный запрос в эти десять минут брал копию из HTTP-кэша браузера. Если две версии выходили подряд, новый кэш получал прошлый `index.html`, и правка не появлялась до следующей версии — это воспроизведено на копии приложения. Теперь каждый файл сверяется с сервером; неизменившийся сервер подтверждает ответом 304 без тела. Шрифты по-прежнему берутся обычным запросом: их содержимое не меняется никогда. **Не убирайте `cache: 'no-cache'`** при правке `fillCache`.
- Добавляете файл, без которого приложение не работает, — впишите его в `APP_ASSETS`.

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

1. Значение для `state.mode`; ветка в диспетчере `renderPracticeView` (≈11978) с функцией `renderXxxView(text)`.
2. Подготовка в трёх местах: `setMode`, `openTermInMode`, `navigateToTerm` — для сброса флагов вроде `xxxFlipped`.
3. Кнопка во **всех восьми** панелях режимов и карточка на экране выбора (`renderChooserView`).
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
| `syncToServer`, `checkAuth`, `authUser`, `sharedToken`, `serverVersion` | Остатки серверной версии; сервера нет |
| `importSharedFolder`, `linkAccountWithSite`, экран `shared` | Заглушки: кнопки есть, но первая только показывает сообщение, а вторая ставит флаг в профиле |
| `renderLandingView` | Только перенаправляет в `renderHomeView` и нигде не вызывается |
| `renderSemanticKeysEditView`, `renderSemanticKeysView`, `revealNextSemanticKey` и связанные `createSemanticKey`, `toggleSemanticKey`, `saveCurrentSelection` со слушателем `selectionchange` | Смысловые ключи. Экраны `keys` и `keys_edit` перенаправлены на `term_chooser`, а `openSemanticKeysEdit/View` ведут туда же |
| `goToPractice`, `setPracticeMode`, `revealWordFully`, `showAllWords`, `nextQuizQuestion`, `deleteText`, `isHardWord` | Не вызываются ниоткуда (проверено поиском по файлу) |
| `text.hintTypes` | Пишется, не читается |
| Содержимое `<div id="app">` в разметке | Снимок старого экрана, заменяется первым `render()` |
| `state.practiceMode === 'combined'` | Устаревшее значение; превращается в `default` |

---

## 14. Известные риски и долги

- **Не везде экранирование.** `${text.title}` вставляется в разметку как есть в `renderTextsView`, `renderChooserView` и `getTermNavHeader`, `${text.example}` — в `renderExampleView`. Данные свои, но угловая скобка в названии сломает вёрстку. Кроме того, `escapeHtml` не экранирует кавычки — для атрибутов есть `escapeHtmlAttr`.
- **Картинки в `localStorage`.** Около 5 МБ на всё; если станет тесно — переносить картинки в IndexedDB.
- **Дублирование стилей** — 19 селекторов объявлены дважды (§3).
- **Панель режимов в восьми копиях**, и они уже разошлись (§6).
- **Устаревшие комментарии.** Например, у `getTokenLineNumbers` написано «те же номера», хотя номеров на чипах больше нет. Комментарий — подсказка, а не истина; сверяйтесь с кодом.
- **Слушатель `touchmove` на карточках списка не пассивный** (`initTermCardSwipe`): ему нужен `preventDefault` при горизонтальном свайпе, но на iOS это может мешать плавности прокрутки.
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
