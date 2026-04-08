# Почему kaiten-mcp существует

## Предыстория

`kaiten-mcp` — это форк [iamtemazhe/mcp-kaiten](https://github.com/iamtemazhe/mcp-kaiten) (оригинал — Артём Железнов). Базовый проект давал хороший фундамент: 41 инструмент, покрывающий жизненный цикл карточки. Но при реальном использовании на production-инстансе Kaiten вылезли пробелы и шероховатости. Этот форк их закрывает.

Имя `mcp-kaiten` в npm по-прежнему принадлежит автору оригинала (текущая версия 1.1.0). Мы публикуем форк под отдельным именем `kaiten-mcp`, начиная с 0.1.0 — чистый старт, чтобы было ясно: это самостоятельная кодовая база, а не drop-in replacement.

## Что добавляет этот форк

Пять волн работы, всё смержено.

### Wave 1 — починка схем

Шесть критичных FAIL-ов в исходных схемах, все обнаружены через сверку с `docs/api/`:

- `list_custom_properties` бил по неправильному endpoint-у
- `list_tags` не умел показывать теги карточки (endpoint требует card scope)
- `update_card.size:N` молча отвергался API
- `update_card.state:N` был no-op (state — computed, не storage)
- `update_card.ownerId:null` отвергался с непонятной 400
- `verbosity=max` для `get_space` / `get_board` не возвращал inline-колонки/дорожки

### Wave 2 — author enrichment, removed-field guidance, boolean coercion

- Ответы comment/timelog теперь содержат `author_name`, даже если API вернул только `author_id`. Текущий пользователь подгружается параллельно и подставляется client-side.
- `update_card.size:N` и `state:N` теперь дают понятные объясняющие ошибки с подсказками про рабочие альтернативы (`sizeText`, `columnId`).
- Boolean-параметры в 11 инструментах теперь принимают строки `"true"` / `"false"`, не только настоящие булевы (потому что `z.coerce.boolean()` сломан — `Boolean("false") === true`).

### Wave 3 — метаданные файлов

`list_files` и `upload_file` возвращали `content_type:null` для каждого файла. Две причины: (1) симплифайер читал несуществующее имя поля, (2) Kaiten вообще не заполняет это поле для обычных upload-ов. Починено: чтение правильного API-поля плюс fallback по расширению имени для 20 распространённых типов.

### Wave 4 — UX/coverage волна (12 net new tools)

Большой apply quality. Четыре фазы, восемь параллельных тиммейтов в worktrees:

- **Библиотека schema-хелперов:** `positiveId`, `optionalPositiveId`, `isoDate`, `requireSomeFields` и т. д., применены равномерно по всем handler-ам.
- **Контекстные подсказки в ошибках:** к ошибкам API подставляется подсказка про связанный read-инструмент («404 на `/cards/{id}` → попробуй `kaiten_search_cards`»), на основе карты из 22 URL→tool паттернов.
- **`verbosity=max` strict-superset ladder:** для 7 типов сущностей (user, timelog, column, lane, space, checklist item, card type) `max` теперь — строгое надмножество `normal`, которое — строгое надмножество `min`.
- **Кросс-ресурсный preflight:** 9 мутирующих инструментов с парой parent/child ID теперь проверяют принадлежность ребёнка родителю до запроса. Закрывает класс silent cross-resource багов.
- **Новые инструменты:** `list_workspace_tags`, `delete_checklist_item`, `rename_checklist`, `list_space_users`, `list_card_members` + `add/remove_card_member` + `set_card_responsible`, `list_card_blockers` + `add/update/release_card_blocker`. Плюс `update_card.properties` для установки значений custom properties inline.
- **Особенность Kaiten, обнаруженная live:** `DELETE` на блокере — это soft release (флаг `released:true`, строка остаётся), а не hard delete. Инструмент назван `release_card_blocker` и `destructiveHint:false`, чтобы это было явно.

### Wave 5 — расширение покрытия (10 net new tools)

Оставшиеся MISSING-useful endpoint-ы из аудита покрытия API:

- **Внешние ссылки карточки** (4 инструмента): list / add / update / remove. Позволяет LLM связать карточку Kaiten с тикетом Jira или issue в GitHub без замусоривания description.
- **Спринты** (2): list / get summary. Read-only.
- **`get_card_location_history`**: аудит, сколько времени карточка стояла в каждой колонке.
- **`list_custom_property_select_values`**: позволяет LLM безопасно ставить значения для `select` / `multi_select` custom properties (без этого Wave 4's `update_card.properties` небезопасен).
- **`get_timesheet`**: глобальный тайм-шит по пользователям/пространствам/доскам для запросов вида «кто сколько отлогировал на этой неделе».
- **`list_subcolumns`**: дополняет структурный view для досок с под-колонками.

Обнаружены и обработаны ещё 5 особенностей Kaiten:

- `location_history.id` — строка, не число. Сохраняется как есть, чтобы не потерять precision.
- `GET /sprints/{id}` для несуществующего спринта возвращает 403, не 404.
- Ответ `POST /cards/{id}/external-links` не содержит `card_id` и `external_link_id` (они появляются только в GET-листинге).
- `GET /time-logs?card_ids=` (пустое значение) даёт 400 — пустые массивы выпиливаются из query string.
- `DELETE /cards/{id}/external-links/{id}` — настоящий hard-delete, асимметричный с soft-release блокеров.

## Что форк сохраняет от upstream

Всё, что уже работало: verbosity ladder, упрощение ответов, retry/idempotency, регистрация ресурсов и промптов, кэш, конфигурация через env, сборка. Wave 1–5 — additive: схемы поджаты, инструменты добавлены, edge cases обработаны. Ничего из upstream tool descriptions или response shapes не сломано.

## Когда использовать форк вместо upstream

- Вы наткнулись на один из багов, починенных Wave 1–3 (custom properties, листинг тегов, обновление size/state, метаданные файлов).
- Нужен инструмент из Wave 4 или 5, которого нет в upstream (members, blockers, external links, sprints, location history, timesheet, custom-property select values, subcolumns, workspace tag listing, checklist rename / item delete, space user listing).
- Нужен preflight safety на кросс-ресурсных мутациях.
- Нужны контекстные подсказки в ошибках вместо сырых ошибок API.

## Когда upstream подойдёт

- Вам нужен только базовый жизненный цикл карточки (CRUD + comments + time logs) и вы не задеваете проблемные области.
- Вы готовы сами дебажить silent fails на обновлениях size/state/owner.
- Вы не используете чеклисты, теги, файлы или custom properties за пределами Wave 0.

## Благодарности

Оригинальная кодовая база `mcp-kaiten`, verbosity model, подход к симплификации, кэш, паттерны resources/prompts и весь build/runtime скелет — это работа [Артёма Железнова (iamtemazhe)](https://github.com/iamtemazhe). Этот форк лежит сверху.
