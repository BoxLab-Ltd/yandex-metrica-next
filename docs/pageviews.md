# Спецификация просмотров

> Контракт поведения трекера. Замораживается в v1.0.
> Раздел 1 — результаты probe 0.5, снятые на живом стенде 2026-08-21.
> Стенд: `research/probe05/` (Next 16.3.3, React 19.2.8, Turbopack, prod-сборка, Chromium 151 через Playwright).

---

## 1. Что показал probe 0.5

Стенд патчит `history.pushState`/`replaceState`, слушает `popstate` и `pageshow`, наблюдает `<title>`
двумя MutationObserver (на самом узле и на `document.head`) и логирует `onRouterTransitionStart`.
Двенадцать сценариев прогнаны на production-сборке.

### 1.1 Порядок сигналов одинаков для всех навигаций

```
ARM  onRouterTransitionStart  url=/b type=push   loc=/a     ← намерение
     history.pushState        url=/b loc=/a                 ← +3…7 мс, location ещё СТАРЫЙ
     title.NODE_REPLACED      now="page-b"                  ← +0…1 мс
```

`replace` и `traverse` отличаются только методом (`replaceState`) и наличием `popstate` перед ARM:

```
popstate                      loc=/a
ARM  onRouterTransitionStart  url=http://localhost:4055/a type=traverse
     history.replaceState     url=/a loc=/a
```

Для `traverse` в ARM приходит **абсолютный** URL, для `push`/`replace` — **root-relative**. Нормализатор
обязан принимать оба.

### 1.2 Записи history без ARM — четыре разных случая

| Случай                             | Наблюдение                                                                    | Как отличить               |
| ---------------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| Инициализация роутера              | `replaceState url=/a loc=/a` через ~15 мс после старта модуля                 | URL не изменился           |
| `router.refresh()`                 | `replaceState url=/a loc=/a`                                                  | URL не изменился           |
| Повторный `push` на текущий URL    | `replaceState url=/b loc=/b`                                                  | URL не изменился           |
| Userland `history.pushState('/x')` | `pushState url=/x loc=/a`, затем Next сам делает `replaceState url=/x loc=/x` | URL изменился, ARM не было |

**Правило:** три первых случая отсекаются одним условием «нормализованный URL изменился».
Отдельного детектора `refresh()` не нужно.

### 1.3 Забытый реэкспорт хука ≠ ноль хитов

Прогон с `instrumentation-client.ts` **без** `export { onRouterTransitionStart }`:

```
ЗАГРУЗКА:      instrumentation-client executed  ← модуль исполняется
PUSH /b:       history.pushState url=/b loc=/a  ← навигация видна
               (ARM отсутствует)
```

Модуль исполняется, тег поднимается, первый просмотр уходит, навигации **наблюдаются через history**.
Теряется только `navigationType`.

**Отсюда архитектура трекера:**

- **COMMIT** = запись history, при которой нормализованный URL изменился. Самодостаточен.
- **ARM** (`onRouterTransitionStart`) = **опциональное обогащение**: даёт `navigationType` и `transitionId`.

Трекер работает без хука и деградирует в `navigationType: 'unknown'`. Диагностика **YM304** остаётся
рабочей и осмысленной: «несколько COMMIT со сменой pathname без единого ARM → похоже, забыт реэкспорт;
тип навигации будет `unknown`». Это **warning**, не error.

> Это исправляет утверждение прежней редакции плана, что забытый реэкспорт даёт ноль навигационных хитов.
> Он их не даёт только при трекере, построенном как «COMMIT строго после ARM» — от такой конструкции отказались.

### 1.4 Отмена: redirect и двойной клик требуют дебаунса

`redirect()` из Server Component (`/redir` → `/b`) порождает **две полные пары ARM+COMMIT**:

```
ARM url=/redir type=push;  pushState url=/redir;     title.NODE_REPLACED now="root"
ARM url=/b type=replace;   replaceState url=/b;      title.NODE_REPLACED now="page-b"   ← +1 мс
```

Просмотр `/redir` физически «случился» в history — то есть ни ARM-, ни COMMIT-сигнал сам по себе его
не отсекает. Двойной клик (`push('/b')`, через 20 мс `push('/a')`) даёт ту же картину с разрывом 14 мс.

**Правило:** отправка COMMIT откладывается на `commitDebounce` (**100 мс**); новый COMMIT отменяет
предыдущий неотправленный. Реальные разрывы — 1 мс и 14 мс — покрываются с запасом. Цена: два осмысленных
клика пользователя внутри 100 мс схлопнутся в один просмотр; это приемлемо.

### 1.5 React 19 заменяет узел `<title>` целиком

`title.NODE_REPLACED` срабатывает при **каждой** навигации, включая случай, когда текст заголовка
не меняется (сценарий 12: `document.title` заранее выставлен в `page-b`, переход на `/b` — узел всё равно
заменён).

Следствия:

- **Наблюдать надо `document.head` с `childList: true`.** Наивный `observe(titleEl, { childList: true,
characterData: true })` пропустит смену: старый узел выбрасывается из DOM, и обсервер на нём умолкает.
- Сигнал приходит **через 0–1 мс** после записи history — то есть `title` готов практически мгновенно.
  `titleTimeout: 400` избыточен, но безопасен как страховка.
- Ранний резолв title-settle надёжен даже на двух страницах с одинаковым заголовком.

### 1.6 Третий аргумент хука

С `experimental.instrumentationClientRouterTransitionEvents: true` приходит
`{ id: 'mt974bqt-1', ... }` — идентификатор вида `${base36(Date.now())}-${counter}`, уникальный в пределах
загрузки страницы. Без флага — строго `null`, и ветка вырезается DCE. Пакет **не включает** чужой
экспериментальный флаг; `transitionId` используется, только если он пришёл.

---

## 2. Алгоритм трекера

```
COMMIT-сигнал: патч history.pushState / history.replaceState + popstate

on historyWrite(url):
  next = normalize(url)                  # basePath, strip, trailingSlash, absolute
  if next === lastCommittedUrl: return   # init роутера, refresh(), повторный push
  if pendingTimer: clearTimeout(pendingTimer)   # отмена: redirect, двойной клик
  pending = { url: next, arm: armWithin(next, 1000) }
  pendingTimer = setTimeout(flush, commitDebounce /* 100 */)

flush():
  lastCommittedUrl = pending.url
  if !shouldTrack(ctx): return
  if quotaExceeded(): warn(YM312); return
  title = await settleTitle(titleTimeout /* 400 */)   # MutationObserver на document.head
  event = beforeSend({ type: 'pageview', url: pending.url, title, ... })
  if event === null: return
  enqueue(() => ym(counterId, 'hit', event.url, { title: event.title, params: event.params }))

on onRouterTransitionStart(url, navigationType, event):
  armLog.push({ url: normalize(url), navigationType, id: event?.id ?? null, at: now() })
  # ARM ничего не отправляет — только обогащает ближайший COMMIT
```

`armWithin(url, ms)` ищет в `armLog` запись с тем же нормализованным URL не старше `ms`; если не нашлось —
`navigationType: 'unknown'` и счётчик для YM304.

---

## 3. Поведенческая таблица

| Событие                          | Решение                                                  | Опция (дефолт)               |
| -------------------------------- | -------------------------------------------------------- | ---------------------------- |
| Первый просмотр после загрузки   | всегда, из `register()`; `referer` = `document.referrer` | `pageviews.first` (`true`)   |
| push / replace / traverse        | просмотр по COMMIT                                       | `navigationTypes`            |
| Смена только query               | не просмотр                                              | `trigger` (`'pathname'`)     |
| Смена только hash                | не просмотр                                              | `trackHashChanges` (`false`) |
| `router.refresh()`               | не просмотр — URL не изменился                           | —                            |
| Инициализация роутера            | не просмотр — URL не изменился                           | —                            |
| Userland `history.pushState`     | просмотр (URL изменился, ARM нет)                        | `trackHistoryApi` (`true`)   |
| `redirect()` из Server Component | просмотр только конечного URL                            | `commitDebounce` (`100`)     |
| Отменённый транзишен             | просмотр только последнего URL                           | `commitDebounce`             |
| Intercepting / parallel route    | просмотр — URL реально сменился                          | `shouldTrack`                |
| bfcache (`pageshow.persisted`)   | не слать                                                 | `bfcache` (`'ignore'`)       |
| Тег ещё не загрузился            | вызов в буфер, флаш при готовности                       | —                            |

Числовые дефолты: `commitDebounce` 100, `dedupeWindow` 500, `commitTimeout` 10 000, `titleTimeout` 400,
`searchDebounce` 500, `initTimeout` 5 000, буфер вызовов 100, `maxPerMinute` 60, усечение URL 2048.

---

## 4. Что считается ломающим изменением

Изменение наблюдаемого **числа или URL** хитов при том же коде пользователя — это breaking по смыслу,
даже когда сигнатуры не менялись: оно ломает отчёты, а не компиляцию. Правило: minor в 0.x, major с 1.0,
и обязательный раздел «что изменится в ваших цифрах» в релиз-нотах.

---

## 5. Результаты остальных экспериментов (2026-08-21)

### Э5 — зеркала: тег НЕ выбирает домен по гео. ЗАКРЫТО

Разбор живого `tag.js` (291 КБ):

- домены в коде — ровно два: `mc.yandex.ru` и `mc.yandex.md`;
- хост сбора **захардкожен**: `host:"mc.yandex.ru"`;
- `geo`, `country`, `tld` — ноль вхождений; `region` встречается 4 раза и только в контексте **consent**
  (`"granted"===…`), то есть про регуляторные регионы, а не про выбор зеркала;
- `mc.webvisor.com/.org` в `tag.js` отсутствуют — они живут в отдельно догружаемом модуле Вебвизора.

**Следствия для `metricaCsp()`:** дефолт `regions: ['ru']` безопасен — трафик сбора идёт на `mc.yandex.ru`.
Но **`mc.yandex.md` обязан быть в `connect-src` всегда**: тег ходит на `https://mc.yandex.md/cc` —
это служебный consent-эндпоинт, и без него ломается механизм согласия. Хосты Вебвизора добавляются
при `webvisor: true`, как и планировалось.

### Э6 — циклический type-импорт под `isolatedDeclarations`: работает. ЗАКРЫТО

Собран мини-пакет (tsdown + `unbundle: true` + `dts` через oxc, `isolatedDeclarations: true`) с намеренным
циклом `index.ts ↔ types/goals.ts`. Результат:

```ts
// dist/index.d.ts — реестр объявлен ЗДЕСЬ, а не реэкспортирован
import { GoalArgs, GoalName } from './types/goals.js'
interface MetricaGoalRegistry {}
export { type GoalArgs, type GoalName, MetricaGoalRegistry, reachGoal }

// dist/types/goals.d.ts — обратная ссылка на цикл сохранена
import { MetricaGoalRegistry } from '../index.js'
```

Потребитель с `declare module` и `@ts-expect-error` на опечатке проходит `tsc --noEmit` чисто —
аугментация видна **и из корня, и из сабпаса `/react`**, а опечатка ловится именно из сабпаса.
Схема §3.2 плана рабочая, дыра №24 закрыта, детектор для тайп-фикстуры воспроизводится.

### Э3 — требует реального счётчика. ПЕРЕНЕСЁН на этап 0.4

Изолированный стенд с подменой сети **не воспроизводит рабочий цикл тега**. Причина установлена:
реальный `mc.yandex.ru/watch/{id}` отвечает **302 с набором `set-cookie`** (`yandexuid`, `ymex`, `i`, `bh`),
а cookie домена `.yandex.ru` при `route.fulfill` из локального origin не сохраняются. Без них счётчик
переходит в деградированный режим: первый (автоматический) хит уходит, а **все последующие
`ym(id,'hit',…)` молча не отправляются** — проверено на трёх формах URL (чужой origin, свой абсолютный,
относительный). Подмена ответа на 302 с cookie ситуацию не меняет.

Вопрос «применяется ли `defer` к `hit`, попавшему в очередь до `init`» решается только на staging-счётчике,
куда отправка законна. До тех пор инвариант «`defer:true` форсирован» держится как проектное допущение.

### Побочная находка, которая меняет тестовую стратегию

План предписывал «три рубежа против загрязнения: `page.route` перехватывает `mc.yandex.*` **по умолчанию**».
Эксперимент показал: **при полном перехвате тег деградирует после первого хита**. То есть e2e с перехватом
проверяет только начальный просмотр, а навигационные хиты — главное, что продаёт пакет, — не проверяет вовсе.

Что делать вместо: разделить два класса e2e.

| Класс                                | Сеть                               | Что проверяет                                                                             |
| ------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| **Оффлайн** (в CI на каждый PR)      | `mc.yandex.*` перехвачен           | что **пакет вызвал** `ym(...)` с нужными аргументами — шпион на `window.ym`, а не на сети |
| **Онлайн** (nightly + перед релизом) | реальная сеть, **staging-счётчик** | что хиты реально уходят и доезжают до отчётов                                             |

Ассерты оффлайн-класса переносятся с сетевого слоя на `window.ym`: это и надёжнее, и не зависит
от внутренних состояний тега. Перехват сети остаётся как страховка от утечки, а не как источник истины.

### Осталось

| #   | Вопрос                                                                                  | Влияние                                               |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Э3  | `defer`/`sendTitle` для `hit` из очереди до `init`                                      | инвариант И3; решается на staging-счётчике (этап 0.4) |
| —   | Компонентный путь: даёт ли `useEffect([pathname])` те же COMMIT-точки, что патч history | вторая ячейка e2e-матрицы                             |
