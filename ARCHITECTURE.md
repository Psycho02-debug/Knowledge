# Архитектура «Запоминалки» — обзор и карта кода

Обзор для того, кто открывает проект без истории переписки: из чего он состоит, где что лежит в `index.html`, какие есть экраны и режимы, как устроены офлайн и зависимости, какие известны риски. Подсистемы подробно — в [docs/](docs/) (список — §2), правила и маршрут «задача → документ» — в [CLAUDE.md](CLAUDE.md), поведение для пользователя — в [README.md](README.md).

**Сверено с кодом 2026-11-04:** версия кэша `zapominalka-v159`, `index.html` — 21 862 строки, 1,04 МБ (по сети около 205 КБ: GitHub Pages отдаёт его сжатым gzip). Номера строк — ориентир для v159: файл правится постоянно, ищите по имени — `grep -n "function имя(" index.html`.

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
 │  index.html ── <style> 7 тыс. строк ── статичная разметка окон ──          │
 │     <script> 14,5 тыс. строк:                                             │
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
- **Почему один файл.** Приложение открывается офлайн мгновенно и обновляется заменой одного файла. Цена — нет модульности, поэтому ориентироваться помогает поиск по именам функций (карта — §3).
- **Одно глобальное состояние** `state`. Отрисовка — функция от `state` и данных; после любого действия вызывается `render()`.
- **Разметка собирается строками.** Шаблонные литералы `` `...${}...` ``, а пользовательский текст пропускается через `escapeHtml()`.

---

## 2. Файлы

| Файл | Роль | Когда меняется |
|---|---|---|
| `index.html` | Всё приложение: стили, разметка окон, логика | Почти в каждой правке; **после неё обязательно поднять версию в `sw.js`** |
| `sw.js` | Service worker: офлайн-кэш и обновление (§5) | Номер версии — при каждой правке `index.html`. Список файлов — при добавлении нового файла приложения |
| `fonts.css` | 41 `@font-face`: Inter 400/500/600/700/800 и Space Grotesk 500/700, разбитые по `unicode-range` | Никогда |
| `fonts/*.woff2` | Сами начертания, 1.2 МБ на всё; имя файла и есть версия содержимого, поэтому service worker переносит их из старого кэша | Никогда. Новое начертание — новый файл с новым именем |
| `manifest.json` | Установка на домашний экран: `start_url: ./index.html`, `display: standalone`, портретная ориентация, цвет `#1f1f1f` | Редко |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Иконки | Редко |
| `CLAUDE.md` | Основной контекст: правила каждой правки, маршрут «задача → документ», ключевые инварианты. Загружается в каждую сессию — держать коротким | Новая общая ловушка, новый документ |
| `ARCHITECTURE.md` | Этот файл: обзор, карта `index.html`, экраны и режимы, service worker, зависимости, риски | При изменении структуры |
| `docs/data.md` | `state`, переменные вне него, ключи `localStorage`, схема данных и материала, индексы слов, запись на диск, запуск | Новое поле, ключ, переменная |
| `docs/rendering.md` | Конвейер отрисовки и патч DOM, анатомия чипа слова, «текст не скачет», длинные списки, экранирование | Правка отрисовки, стилей практики, анимаций |
| `docs/input.md` | Глобальные слушатели, порядок проверок диспетчера клавиатуры, модальные окна, фокус поля | Новая клавиша, слушатель, окно |
| `docs/practice.md` | «Выбор», практика: раскрытие, фокус, подсказка, сложные слова, «Строка по кругу» | Правка этих режимов |
| `docs/modes.md` | «Вписать», «Собери текст», «Тест», «Строки», «Номера», «Вопросы», «Карточка», «Пример» | Правка этих режимов |
| `docs/audio.md` | Озвучка: запись, загрузка, IndexedDB, плеер, границы блоков | Правка звука |
| `docs/transfer.md` | Экран «Материалы», форматы переноса через буфер, загрузка списка | Правка списка или переноса |
| `docs/flashcards.md` | Флеш-карточки, курсы, статистика, главная, профиль | Правка этих разделов |
| `docs/performance.md` | Требования к батарее и скорости, как мерить, история оптимизаций с замерами | Новая оптимизация или замер |
| `docs/workflow.md` | Проверка правок, стиль кода, рецепты изменений, мёртвый код, команды для ориентирования | Новый приём проверки или рецепт |
| `README.md` | Возможности и клавиши — для пользователя | Новая функция или клавиша |
| `КАК РАЗМЕСТИТЬ НА GITHUB.md` | Публикация на GitHub Pages и обновление на телефоне — для человека | Редко |
| `.gitignore` | `.DS_Store` и `graphify-out/` | — |
| `graphify-out/` | Не в git. Граф graphify, обновляется `graphify update .`. Разбирает только `.md`, `sw.js` и `manifest.json`, но не `index.html` — для кода нужен `grep` | Сам |

Документация в кэш service worker не попадает: правка `.md` не требует поднимать версию.

Вне репозитория, в родительской папке: `Стек приложения Запоминалка.docx` — снимок 27 июля 2026 (v9: 11 866 строк, шрифты внутри файла, четыре ключа хранения) — **устарел**, опираться на него нельзя; `Образцы нейроголосов/` — образцы голосов автоматической озвучки, убранной в v138; пустая папка `МОбилка для запоминания`.

---

## 3. Внутреннее устройство `index.html`

| Строки (≈ v159) | Что там |
|---|---|
| 1–12 | `<head>`: viewport без масштабирования, manifest, мета-теги для iOS, `fonts.css` |
| 13–7021 | `<style>` — все стили, около 7 тысяч строк |
| 7027 | `<div id="app"></div>` — пустой: экран целиком рисует `render()` при запуске. Раньше здесь лежал устаревший снимок экрана папок — его убрали, он лишь разбирался, начинал анимацию и тут же стирался |
| ≈7029–7338 | Четырнадцать модальных окон статичной разметкой (список — [docs/input.md](docs/input.md), «Модальные окна») |
| 7341–21852 | Основной `<script>`. В конце — `loadTheme()` (21347), главный диспетчер клавиатуры (21357) и `loadData()` (21851) |
| 21855–21861 | Второй `<script>`: регистрация service worker по событию `load` |

### Стили

- `:root` (≈14) — палитра «тёмная оливковая», переменные `--bg-*`, `--text-*`, `--accent-*`, `--gradient-*`, `--shadow-*`.
- `body.dark-theme` (≈63) — вторая палитра, ещё глубже. Светлой темы нет: обе тёмные.
- `@media (prefers-reduced-motion: reduce)` (≈307) — гасит анимации.
- `#app.no-entry-anim` (≈324) — выключает анимации появления при обновлении того же экрана.
- Чипы слов: `.word`, `.word.hidden-word`, `.has-letters`, `.has-custom-hint`, `.hard-word`, `.practice-focus-active` и затухание соседей в режиме фокуса — ≈1452–1660.
- Альбомная ориентация: `@media (orientation: landscape) and (max-height: 560px)` (≈1352, ≈1734).
- Режим «Вписать» — `/* Type mode styles */` ≈2842 и его копия ≈3144, карточка термина — ≈5103 (`.termcard-*`), режим «Номера» — ≈5805 (`.numbers-*`), курсы — ≈6741 (`/* ===== COURSES ===== */`).
- Узкие экраны — `@media (max-width: 860px)` (≈6621) и `(max-width: 480px)` (≈6633).

> **Ловушка: селекторы повторяются.** Девятнадцать селекторов верхнего уровня объявлены дважды. Например, блок `/* Type mode styles */` скопирован целиком (≈2842 и ≈3144): `.type-input-wrap`, `.type-input-field` и соседние. При одинаковой специфичности побеждает последнее объявление. Перед правкой стиля найдите **все** вхождения селектора.

### Основной скрипт по областям

Порядок в файле — исторический, а не логический. Таблица идёт сверху вниз; крупные разделы помечены в коде заголовками `// ——— Название ———` (их список: `grep -n "^        // ——— " index.html`).

| Строки (≈ v159) | Область | Ключевые функции |
|---|---|---|
| 7341–7413 | Глобальные переменные списка, тема, размер текста | `toggleTheme`, `loadTheme`, `loadPracticeTextScale`, `getTermCountText` |
| 7414–7524 | Форма материала, группы скрытых слов | `ensureTextStudyData`, `getHiddenWordGroups`, `computeHiddenWordGroups`, `getHiddenWordGroupByIndex`, `renderGroupsMemo` |
| 7525–7885 | Классификация токенов, отделение знаков препинания, ремонт индексов (`// ——— Починка съехавшей разметки`) | `isPunctuationToken`, `isNumericListMarkerToken`, `isSlashSeparatorToken`, `splitEdgePunctuation`, `splitEdgeToken`, `repairWordIndexAlignment`, `applyPunctuationSplitToText`, `normalizeAllMaterialsPunctuation` |
| 7886–8178 | Перенос разметки при правке текста, объединение слов в вопросах | `buildContentWordIndexMap`, `remapProcessedTextState`, `updateMaterialContentPreservingProcessing`, `getRenderableHiddenIndices`, `buildBatchHintUnits`, `mergeBatchHintWithNext` |
| 8179–8286 | Поиск, сортировка, склонения | `filterTerms`, `clearSearch`, `toggleSort`, `getAllMaterialEntries`, `getCardCountText` |
| 8287–8545 | Нормализация карточек и курсов, встроенный набор карточек | `normalizeFlashcardCard/Folder/FoldersTree`, `normalizeCourseTask/Lesson/Folder/FoldersTree`, `getDefaultCourseStudyState`, `getBuiltInFlashcardFolders`, `ensureBuiltInFlashcardFolders` |
| 8546–8728 | Значения по умолчанию, иконки, профиль | `getDefaultFlashcardSessionConfig`, `getDefaultFlashcardStudyState`, `getDefaultProfile`, `getLocalProfile`, `saveProfile`, `linkAccountWithSite` |
| 8729–8815 | Очередь изучения: порядок перехода между материалами | `setStudyQueueFromVisibleEntries`, `getStudyNavigationMeta`, `getStudyNavigationTarget`, `applyStudyNavigationTarget` |
| 8816–8926 | **`state`** и переменные отложенной записи | `state`, `lastSavedData`, `renderQueuedWhileHidden`, `lastRenderSignature`, `HAS_TOUCH_INPUT` |
| 8927–9173 | Хранение и запуск, слушатели жизненного цикла, папка при запуске | `scheduleIdleTask`, `flushSaveData`, `flushLocalStats`, `flushPendingPersistence`, `getLocalData`, `loadData`, `openStartupFolder`, `saveData` |
| 9174–9286 | Дерево папок, записи списка материалов | `ensureFolderShape`, `normalizeFoldersTree`, `getTopFolder`, `getCurrentFolder`, `getCurrentFolderTitle`, `buildTextsViewEntries`, `getTextLocationFromListIndex`, `shuffleVisibleTexts` |
| 9287–9631 | Статистика, мелкие помощники, подготовка «Игры» (в том числе `// ——— «Собери текст по строкам»`) и «Теста» | `getLocalStats`, `saveLocalStats`, `buildStatsSummary`, `getFirstLettersOnly`, `getMaxHintLetters`, `shuffleArray`, `initGame`, `initQuiz` |
| 9632–9905 | **Конвейер отрисовки** | `syncElementAttributes`, `patchChildNodes`, `setAppHtml`, `render`, `renderScreen`, `syncDockSpacing` |
| 9906–10574 | Режим «Вписать», раскладка клавиатуры, каскад появления карточек | `renderTypeView`, `normalizeTypeWord`, `convertKeyboardLayout`, `typeWordMatches`, `getTypeSequenceTokens`, `evaluateTypedWords`, `checkTypeWord`, `focusTypeField`, `syncTypeTextClamp`, `toggleTypeFocusLine`, `compactMarkup`, `getTermCardEntryDelay` |
| 10575–10818 | Смена режима, свайп и перетаскивание карточек, пометка сложных материалов | `setMode`, `initTermCardSwipe`, `initDragReorder`, `toggleAttention`, `resetAllAttention`, `toggleDifficultFilter` |
| 10819–10965 | Главная навигация и нижняя панель вкладок | `setPrimaryView`, `handlePrimaryCreateAction`, `openLearningBranch`, `renderBottomNav`, `renderShell` |
| 10966–11548 | Главная, «База знаний», хаб обучения, папки карточек | `renderHomeView`, `renderSharedView`, `renderLearningHubView`, `renderFlashcardFoldersView`, `renderFlashcardFolderView` |
| 11549–12321 | Курсы: действия, экраны, окна | `openCourseLesson`, `submitCourseQuizChoice`, `selectCourseMatchTerm`, `renderCourseFoldersView`, `renderCourseFolderView`, `renderCourseLessonEditView`, `renderCourseLessonView`, `saveCourseLesson`, `saveCourseTask` |
| 12322–12677 | Экраны изучения карточек | `renderFlashcardModeToolbar` (шапка, «↺ Начать заново»), `renderFlashcardModeComplete`, `renderFlashcard{Learn,Write,Test,Match,Browse}Body`, `renderFlashcardStudyView` |
| 12678–12881 | Статистика, экспорт папки в JSON, список папок, профиль | `renderStatsView`, `shareFolder`, `renderFoldersView`, `renderProfileView` |
| 12882–13096 | **Экран «Материалы»** (список материалов папки) | `renderTextsView` |
| 13097–13278 | Экран материала (выбор режима), шапка термина | `renderChooserView`, `navigateChooser`, `getTermNavHeader` |
| 13279–13401 | Фокус в практике | `getPracticeFocusTargets`, `getPracticeFocusSpan`, `advancePracticeFocus`, `focusNextPracticeWord` |
| 13402–13668 | Строка на экране, «Строка по кругу», выделение слов в круге | `getPracticeLines`, `getPracticeLineRange`, `stepPracticeLine`, `practiceCircleStep`, `togglePracticeCircleLine`, `toggleCirclePicking`, `clearCirclePicks` |
| 13669–13805 | Чтобы текст в практике не скакал | `syncPracticeTextAnchor`, `capturePracticeScrollAnchor`, `restorePracticeScrollAnchor`, `scrollWordIntoViewIfBelow` |
| 13806–13925 | Отметка «сложное слово», чип скрытого слова | `toggleHardWord`, `startHardPress`, `renderPracticeHiddenWord` |
| 13926–14360 | **Практика и выбор слов** | `renderPracticeView`: режимы `edit` и `practice`, а для остальных — диспетчер |
| 14361–14521 | Пример, карточки по строкам | `renderExampleView`, `buildLineCards`, `renderLineCardsView` |
| 14522–14701 | Режим «Номера» | `buildNumbersLines`, `renderNumbersView` |
| 14702–16335 | **Озвучка**: хранение, запись, загрузка файла, воспроизведение, плеер (окно, управление, скорость, обновление во время игры, границы блоков, поиск пауз, дорожка под пальцем) | `openAudioDb`, `saveAudioClip`, `startAudioRecording`, `chooseAudioFile`, `getAudioPlayer`, `openAudioPlayer`, `renderAudioPlayer`, `setAudioRateMenu`, `findAudioPauses`, `onAudioTrackPointerDown` |
| 16336–16691 | Карточка «термин ↔ текст» (размер текста, полноэкранный режим), вопросы к термину | `formatContentForReading`, `setTermCardTextScale`, `enterTermCardFullscreen`, `renderTermCardView`, `saveQuestionEntry`, `renderQuestionsView` |
| 16692–16979 | «Собери текст», тест по материалу, тест по папке | `renderGameView`, `renderQuizView`, `selectQuizOption`, `renderFolderQuizView` |
| 16980–17318 | Окно запуска игр, перенос материалов в модуль, логика теста по папке | `openGameSetup`, `startGameWithSelected`, `showTransferTermsModal`, `transferSelectedTermsToSubfolder`, `startFolderQuiz` |
| 17319–17589 | Запись статистики, «Сопоставление», правка и удаление материала из списка, ход в «Собери текст» | `recordStudyStats`, `startMatchingGame`, `renderMatchingView`, `editTerm`, `deleteTerm`, `selectWord` |
| 17590–18654 | Открытие папок, карточки: действия, перенос и движок изучения | `openFolder`, `openFlashcardFolder`, `startFlashcardMode`, `prepareLearnPrompt`, `advanceLearnPrompt`, `armFlashcardTimer`, `syncFlashcardTimer`, `resolveFlashcardMatchAttempt` |
| 18655–18858 | Навигация по текстам | `openSubfolder`, `openText`, `openTermInMode`, `switchStudyModeByHotkey`, `goBack`, `goBackToTexts`, `goBackToChooser` |
| 18859–18919 | Экранирование, переход между материалами | `escapeHtml`, `escapeHtmlAttr`, `navigateToTerm` |
| 18920–19006 | Поле описания: автонумерация списков | `handleDescriptionFocus`, `insertNextListNumber`, `renumberListBelow`, `handleDescriptionBeforeInput` |
| 19007–19418 | Форматы переноса, выбор материалов, копирование | `buildProcessedDescriptionExport`, `buildProcessedFolderExport`, `parseProcessedFolderImport`, `parseProcessedDescriptionImport`, `parseCombinedMaterialImport`, `copyPlainTextToClipboard`, `toggleTextSelection`, `copySelectedMaterials` |
| 19419–19719 | Вставка в поля, открытие окон, картинки | `handleTitleFieldPaste`, `handleDescriptionPaste`, `handleFolderNamePaste`, `showFolderModal`, `showTextModal`, `handleImageUpload` |
| 19720–20369 | Загрузка списка карточек: текст, .xlsx, .docx, .csv; перенос карточек | `FLASHCARD_IMPORT_TEMPLATE`, `parseFlashcardBulkImport`, `readZipTextEntries`, `inflateZipEntry`, `xlsxToPlainText`, `docxToPlainText`, `csvToPlainText`, `applyFlashcardImport` |
| 20370–20552 | Закрытие окон, Escape, Cmd+Shift в окне материала | `closeModal`, `handleEscapeAction`, `saveTextAndSelectWords`, `runModalShortcut` |
| 20553–20834 | Сохранение из окон, загрузка списка материалов, порядок и удаление папок | `saveFolder`, `saveFlashcard`, `saveText`, `processBulkImport`, `moveFolder`, `deleteFolder` |
| 20835–21095 | Выбор слов: отметка, скрытие, вопросы к словам | `toggleMark`, `applyBatchHide`, `selectAllPendingWords`, `showBatchHintModal`, `saveCurrentWordHint`, `finishBatchHint`, `saveHint` |
| 21096–21346 | Практика: раскрытие и подсказки | `getActivePracticeTargetIndex`, `revealNextHintLetter`, `revealWord`, `toggleAllWordsReveal`, `resetReveal`, `setPracticeTextScale`, `clearMarks` |
| 21347–21852 | Запуск: тема и масштаб, **диспетчер клавиатуры**, `loadData()` | безымянный обработчик `keydown` ([docs/input.md](docs/input.md)) |

---

## 4. Экраны и режимы

`state.view` выбирает функцию отрисовки в `renderScreen()` (≈9786):

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
   │                                         openTermInMode(i, mode) / клавиши 1–7 │ ▲ goBackToChooser()
   │                                                                               ▼ │
   │                                     practice (mode: edit | practice | game | quiz |
   │                                               linecards | numbers | questions | termcard | example)
   │                                     type     (mode: type)
   │                                     внутри: setMode(m) — панель режимов; ← → — navigateToTerm(±1)
```

- `openText(vi)` принимает индекс **в видимом списке** и переводит его в место хранения через `getTextLocationFromListIndex()`, а заодно запоминает очередь `studyQueue`.
- `openTermInMode(index, mode, practiceSubMode)` — главный вход в режим. Он сбрасывает `revealedWords` и `halfRevealedWords`, фокус и выделение, а также запускает `initGame`, `initQuiz` или `initTypeMode`.
- `setMode(mode)` — смена режима с панели внутри материала. Её нет в `edit` и `practice`: туда и обратно переключают клавиши `1`–`7` и «Назад».
- `navigateToTerm(±1)` — соседний материал в **том же** режиме, по очереди `studyQueue`.
- `setPrimaryView(view)` — вкладки нижней панели. Переход в `learning` или `folders` сбрасывает всю навигацию.

### Режимы материала (`state.mode`)

| `mode` | Название в интерфейсе | Рисует | Подготовка |
|---|---|---|---|
| `edit` | «Выбор» (выделить слова) | `renderPracticeView`, ветка `edit` | — |
| `practice` | «Практика»: полностью скрытые, первая буква, вопросы, «Строка по кругу» — по `practiceMode` (`default`, `firstletter`, `hints`, `circle`) | `renderPracticeView` | — |
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

Подробно о режимах: «Выбор» и практика — [docs/practice.md](docs/practice.md), остальные — [docs/modes.md](docs/modes.md).

---

## 5. Service worker (`sw.js`)

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

## 6. Зависимости

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
- `getRenderableHiddenIndices` зависит от `state.view`, `state.mode` и `state.practiceMode` (в «Строке по кругу» — только строку на экране): в режиме вопросов участники группы скрыты за ведущим словом.
- `typeWordMatches` ← `normalizeTypeWord` ← `convertKeyboardLayout`: меняя нормализацию, проверьте обе раскладки.

---

## 7. Известные риски и долги

- **Не везде экранирование.** `${text.title}` вставляется в разметку как есть в `renderTextsView`, `renderChooserView` и `getTermNavHeader`, `${t.title}` — в окне запуска игр (`openGameSetup`) и в `renderMatchingView`, `${text.example}` — в `renderExampleView`. Данные свои, но угловая скобка в названии сломает вёрстку. Кроме того, `escapeHtml` не экранирует кавычки — для атрибутов есть `escapeHtmlAttr`.
- **Картинки в `localStorage`.** Около 5 МБ на всё; если станет тесно — переносить картинки в IndexedDB.
- **Дублирование стилей** — 19 селекторов объявлены дважды (§3).
- **Панель режимов в девяти копиях**, и они уже разошлись (§4).
- **Устаревшие комментарии.** Например, у `getTokenLineNumbers` написано «те же номера», хотя номеров на чипах больше нет. Комментарий — подсказка, а не истина; сверяйтесь с кодом.
- **Плеер озвучки на настоящем iPhone не проверялся.** В браузере Claude (ширина 390 и 375) проверены: игра, пауза, ±5 с, блоки вперёд-назад, перемотка нажатием и ведением по дорожке, переход по блоку из списка, продолжение с запомненного места, конец звука, закрытие при игре и на паузе, v141: окна «Озвучка» и кнопок «🔊 N» нет, карточка «Озвучка» и кнопка в шапке открывают плеер; без звука — загрузка файла (и «не звук» — сообщение, звук не тронут), запись с подменённым микрофоном (панель записи, «Стоп» сохраняет, закрытие плеера посреди записи сохраняет и выключает микрофон, отказ в микрофоне — сообщение), замена и удаление звука, звук к пунктам — «Пункты по порядку» и удаление; скорость (v140: список открывается, выбор меняет скорость и посреди игры — на 0,75× за 2 с проходит 1,5 с записи, нажатие мимо закрывает список и срабатывает само, `Escape` сперва закрывает список, слушатель на документе снимается при любом закрытии, список целиком виден в окне), перетаскивание границ и отмена жеста, ±0,5 с, «Сюда», разметка на слух и её отмена, поиск пауз (на озвучке «Милены» с паузами 0,9 с — границы за 0,15–0,2 с до первого слова), сохранение после перезагрузки, клавиши, материал из одной строки, звук только к пунктам. Не проверены: перетаскивание пальцем на iOS (`touch-action: pan-y`, `pointercancel`), перемотка до первого `play()` в Safari, `decodeAudioData` и память на длинном MP3 на iPhone, звук после закрытия плеера при выключенном экране.
- **Загрузка аудиофайла на настоящем iPhone не проверялась.** В браузере Claude проверены выбор файла (подменой `input.files`), отказ на «не звук», звук ко всему тексту и к пунктам, «Слушать весь текст», «Номера», удаление вместе с материалом. Не проверены: какой выбор показывает iPhone на `accept="audio/*,…"` (ожидаются «Файлы»), читает ли Safari длительность до нажатия «Слушать» (если нет — файл примется без длительности) и как ведут себя большие файлы.
- **Тестов нет.** Проверка — в браузере ([docs/workflow.md](docs/workflow.md), [docs/performance.md](docs/performance.md)).
- **Ничего не проверено на настоящем iPhone**, кроме того, что пользователь видел сам: все проверки — во встроенном браузере Claude на ширине 320–1280 px, включая альбомную.
- **Выкладка GitHub Pages может сорваться** на стороне GitHub (v159: тайм-аут шага Deploy, затем очередь из-за сбоя Actions). Порядок проверки — CLAUDE.md, «Обязательное при каждой правке».
