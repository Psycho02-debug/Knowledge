# Движок нейроголосов — откуда файлы и на каких условиях

Папка `tts/` — движок, которым приложение читает текст нейроголосами Piper прямо на телефоне (см. README, «Озвучка пунктов», и ARCHITECTURE.md, §9, «Нейроголоса»). Здесь только готовые сборки чужих проектов; своего кода в папке нет.

Имена папок содержат версию. Файлы движка приложение кладёт в кэш голосов, который переживает обновления приложения, поэтому **новую версию движка кладите в новую папку** и меняйте пути в `NEURAL_ENGINE_FILES` (`index.html`), а старую не перезаписывайте.

## `ort-1.18.0/` — ONNX Runtime Web 1.18.0

- Что: исполнитель нейросетей в WebAssembly. Нужны два файла сборки «только wasm»: `ort.wasm.min.js` и `ort-wasm-simd.wasm` (один поток, SIMD).
- Откуда: cdnjs, `onnxruntime-web/1.18.0/` — та же сборка, что в npm-пакете `onnxruntime-web@1.18.0`.
- Исходники: https://github.com/microsoft/onnxruntime
- Лицензия: MIT, © Microsoft Corporation.

## `piper-phonemize-ru/` — piper_phonemize (espeak-ng в WebAssembly)

- Что: переводит русский текст в фонемы — в тот вид, который понимают модели Piper. Внутри — espeak-ng.
- Откуда: npm-пакет `@diffusionstudio/piper-wasm@1.0.0` (https://github.com/diffusion-studio/piper-wasm, его использует проект https://github.com/diffusionstudio/vits-web).
- Изменено: из пакета данных `piper_phonemize.data` оставлены только файлы, нужные русскому языку, — `phondata`, `phonindex`, `phontab`, `intonations`, `ru_dict`, `lang/zle/ru`, а также `en_dict` и `lang/gmw/en`, без которых espeak не читает латинские буквы в русском тексте (I = U / R). Пакет уменьшился с 18 до 9,3 МБ; таблица файлов внутри `piper_phonemize.js` пересчитана. На проверочных фразах номера фонем совпадают с полной версией.
- Исходники:
  - piper-phonemize — https://github.com/rhasspy/piper-phonemize (MIT);
  - espeak-ng — https://github.com/espeak-ng/espeak-ng (GPL-3.0 или новее);
  - сборка в WebAssembly — https://github.com/diffusion-studio/piper-wasm (MIT).
- Лицензия: скомпилированный модуль содержит espeak-ng, поэтому на него распространяется GPL-3.0. Исходный код всех частей открыт по ссылкам выше.

## Модели голосов — в репозитории их нет

Модели (по 63 МБ) приложение скачивает по кнопке «Скачать» прямо с Hugging Face: https://huggingface.co/rhasspy/piper-voices, папка `ru/ru_RU/`. Все четыре — качество `medium`, дообучены из английского голоса lessac. Лицензии наборов записей, на которых они обучены (из MODEL_CARD каждой модели):

| Голос | Набор записей | Лицензия набора |
|---|---|---|
| Руслан (`ruslan`) | https://ruslan-corpus.github.io/ | CC BY-NC-SA 4.0 — только некоммерческое использование |
| Денис (`denis`) | https://github.com/OHF-Voice/voice-datasets | CC0 |
| Дмитрий (`dmitri`) | https://github.com/OHF-Voice/voice-datasets | CC0 |
| Ирина (`irina`) | https://github.com/RHVoice/RHVoice | не указана |

Приложение личное и бесплатное, так что ограничение «Руслана» на коммерческое использование его не касается. Если приложение когда-нибудь станет коммерческим, «Руслана» и «Ирину» придётся убрать или заменить.
