# Режимы материала, кроме практики

> **Когда читать:** правка «Вписать», «Собери текст», «Теста», «Строк», «Номеров», «Вопросов», «Карточки», «Примера». Таблица всех режимов и панель режимов в девяти копиях — [ARCHITECTURE.md](../ARCHITECTURE.md), §4.  
> **Сверено с кодом:** 2026-11-04, версия кэша `zapominalka-v159`. Номера строк — ориентир для v159, ищите по имени функции.  
> **Связано:** [practice.md](practice.md), [rendering.md](rendering.md) — условные блоки рядом с полем ввода, [input.md](input.md) · наверх: [CLAUDE.md](../CLAUDE.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

## «Вписать» (`view = 'type'`)

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
- Завершение — то же `.type-card` с полным текстом; если часть слов открыта нажатием, заголовок «Текст открыт» и счёт «вписано N из M». `Enter` на нём ведёт к следующему материалу (диспетчер, шаг 3 — [input.md](input.md)).

## Остальные режимы

- `game` — `initGame()` перемешивает слова в `gameState.scrambledWords`; `selectWord`, `removeFromResult`, `restartGame`. При `state.gameByLines` (карточка «Собери текст по строкам», `openGameMode(index, true)`) `initGame` зовёт `startGameLine(text, 0, 0)`: строки — `getGameLines` = `buildNumbersLines` без строк из одного номера, в `gameState` добавляются `byLines`, `lineIndex`, `lineCount`, `lineMarker`, `lineDone`, а `correctOrder` и плитки — слова одной строки. Собранная строка (кроме последней) ставит `lineDone`: плитки сменяет кнопка «Следующая строка ›» (`nextGameLine`, и `Enter`), собранные слова больше не снимаются; `errors` переносится между строками. Последняя строка ставит `completed`, как обычная игра. **Номера плиток** по строкам — `getGameTileKeys(gs)`: цифры `1`…`9`, `0` получают плитки первых десяти слов строки по порядку текста (`originalIndex < 10`), пронумерованные в порядке плиток на экране; слова дальше десятого — конец строки — без номера. Цифра в углу — `.game-key-badge`, у контейнера — класс `has-keys` (плитке нужен `position: relative`), в подсказке над игрой — `.game-key-hint`. **Поле номеров** `.game-type-input` стоит в `.game-result` (класс `has-type-input`) после обёртки слов `.game-result-words` (`display: contents`): у `.game-result` всегда три ребёнка, иначе `patchChildNodes` пересобрал бы его через `innerHTML`, и поле теряло бы фокус на каждом слове. Клавиши поля — `handleGameTypeKey`: цифра → `selectGameTileByKey`, `Backspace`/`Delete` → `removeLastGameWord`, `Enter` → `nextGameLine`, остальные печатные символы глотаются (из поля диспетчер выходит на шаге 5, так что горячие клавиши экрана не срабатывают); вставку разбирает `handleGameTypeInput`. После каждой отрисовки игры `syncGameTypeFocus` возвращает фокус в поле, если он не в другом поле и нет окна (клик по плитке уводит фокус на body). Поле, цифры и подсказку прячет `@media (hover: none)`, а `.game-placeholder` при поле — `@media (hover: hover)`. Какие плитки собраны — `getGameUsedTiles(gs)`: по строкам — ровно выбранные (`gs.pickedTiles`, номера плиток по порядку собранных слов; `selectWord` дописывает, `removeFromResult` обрезает), по словам — счётом (одинаковые слова гаснут слева направо). Слова в разметке игры идут через `escapeHtml`.
- `quiz` — `initQuiz()` берёт описания до трёх других материалов той же папки как неверные варианты (нужно минимум два материала); `selectQuizOption`, `restartQuiz`.
- `linecards` — `buildLineCards()` по строкам (`getTextManualLines`), подсказка — первая буква или первое слово (`lineCardCueMode`).
- `numbers` — `buildNumbersLines()`: строки из `getTextManualLines(formatContentForReading(content))`, маркер строки (`NUMBERS_MARKER_RE`: «1.», «2)», «а)», «—», «•») или порядковый «N.», слова строки с приклеенными к ним знаками препинания (кроме тире: отдельно стоящее «—», «–», «-» идёт со следующим словом — «— ом», а не «сопротивления— ом»). Состояние — одно число открытых слов `numbersRevealCount` вне `state`, привязанное к материалу ключом `numbersRevealKey` (папка, подпапка, индекс, длина текста): сменился материал — счёт с нуля. `numbersHint` — +1 слово, `numbersShowLine` — до конца строки со следующим закрытым словом, при всём открытом — сброс. Стрелки на экране — `navigateToTerm(±1)`. Кнопка «Номера» стоит во всех панелях режимов рядом со «Строками»; у самой практики панели нет.
- `termcard` — `renderTermCardView`: лицевая сторона — `title`, оборотная — `formatContentForReading(content)`, где знаки снова прилеплены к словам. Хранит только размер текста — `text.cardTextScale` (переменная `--card-text-scale` на карточке; ползунок меняет её прямо в DOM без перерисовки, сохраняет `onchange`). При `state.termCardFullscreen` вместо обычной разметки рисуется слой `.termcard-fullscreen` (fixed, z-index 150, между шапками и окнами); `enterTermCardFullscreen` на компьютере и iPad ещё и вызывает `requestFullscreen`.
- `questions` — `text.questions`, окно `questionModal`.
- `example` — `renderExampleView`, показывает `text.example`.
