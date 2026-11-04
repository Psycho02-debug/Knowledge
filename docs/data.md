# Состояние и данные

> **Когда читать:** правка `state`, полей материала, ключей `localStorage`, индексов слов, записи на диск и запуска.  
> **Сверено с кодом:** 2026-11-04, версия кэша `zapominalka-v159`. Номера строк — ориентир для v159, ищите по имени функции.  
> **Связано:** [rendering.md](rendering.md) — кто читает данные при отрисовке, [practice.md](practice.md), [audio.md](audio.md) — пометка звука · наверх: [CLAUDE.md](../CLAUDE.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

## Состояние

### Глобальный объект `state` (≈8816)

Объявлен через `let`, поэтому в `window` не попадает: из консоли он доступен, а из соседнего `iframe` — только как `frame.contentWindow.eval('state')`.

**Навигация**

| Поле | Значения и смысл |
|---|---|
| `view` | Открытый экран — список в §6 |
| `mode` | Режим внутри материала: `edit`, `practice`, `type`, `game`, `quiz`, `linecards`, `numbers`, `questions`, `termcard`, `example`; `null` — на экране выбора режима (`term_chooser`) |
| `practiceMode` | Вид скрытых слов в режиме `practice`: `default` — пустая плашка, `firstletter` — первая буква, `hints` — свой вопрос, `circle` — пустая плашка, одна строка на экране, слова проходятся кругами («Строка по кругу»). Устаревшее `combined` молча превращается в `default` |
| `practiceLineIndex` | Строка на экране в «Строке по кругу» (`circle`). Отрицательное — с конца (−1 — последняя); приводит к числу строк `getPracticeLineRange`. Сбрасывают в 0 `setMode`, `openTermInMode`, `navigateToTerm` (ему можно передать строку вторым аргументом) |
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
| `gameByLines` | «Собери текст по строкам» (`true`) или по словам; выбирается карточкой экрана материала (`openGameMode`) и сохраняется при кнопке «Игра» и переходе между материалами |
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
| `folders`, `flashcardFolders`, `courseFolders` | Все данные пользователя (ниже, «Данные и хранение») |
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
| `renderGroupsMemo` | Память групп скрытых слов на время одной отрисовки ([rendering.md](rendering.md), «Внутри отрисовки разметку текста менять нельзя») |
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

## Данные и хранение

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

Кроме `localStorage` есть одно хранилище — **IndexedDB `zapominalkaAudio`**, хранилище `clips`: звук к материалам — свои записи и загруженные аудиофайлы ([audio.md](audio.md)). Ключ — `«text.audio.id»:«номер пункта»` (звук ко всему тексту — номер `-1`, `AUDIO_WHOLE_INDEX`), значение — `{ data: ArrayBuffer, type }`. Ключи `speechVoice` и `speechRate` в `localStorage` остались от автоматической озвучки (до v138) — их удаляет запуск. Cookies и `sessionStorage` не используются. `localStorage` даёт около 5 МБ на всё; самое объёмное там — картинки в base64 внутри материалов и карточек.

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
- Любой код, который работает с индексами, обязан токенизировать **ровно так**. `match(/\S+|\s+/g)` этой пустой строки не даёт и на таком тексте расходится со `split` на единицу — однажды из-за этого разбор вставки разошёлся со `split`: часть разметки встала на пробелы, такие слова не рисовались вовсе, а номера на чипах (их тогда ещё рисовали) шли через один. Теперь и разбор вставки считает индексы через `split`.
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

### Запуск: `loadData()` (≈9051)

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

## Правила

### Индекс материала бывает двух видов

`state.currentText` — позиция в массиве **папки** (`getCurrentFolder().texts`). А `openText(vi)`, свайп, перетаскивание и выбор материалов получают позицию в **видимом списке**: после поиска, фильтра «сложные», сортировки и с материалами модулей, если открыта сама папка. Перевод делает `getTextLocationFromListIndex(vi)` по `textsViewEntriesCache`, а этот кэш заполняет `renderTextsView()`.

Поэтому `toggleAttention(index)` на экране «Материалы» понимает индекс как видимый, а на остальных — как индекс в папке. Перепутать их — значит пометить чужой материал.

### Открытые слова на диск не пишутся

`revealedWords`, `halfRevealedWords` и `hintLetters` — состояние экрана: любой вход в материал их обнуляет (`hintLetters` читается только для слов из `halfRevealedWords`), а `stringifyPersistentData()` пишет их пустыми (выше, «Запись на диск»). «Подсказка» поэтому вовсе не вызывает `saveData()`. **Не возвращайте их в запись** и не используйте эти поля как данные, которые должны пережить перезапуск.

### Запись отложенная

Сразу после действия в `localStorage` может лежать ещё старое значение — это не ошибка, а экономия батареи. Проверяя сохранение, вызывайте `flushPendingPersistence()` явно.
