/* Warsaw Flats — прототип интерфейса.
 *
 * Данные приходят готовыми из 5.web/export.py (apartments.json + meta.json).
 * Питон здесь ничего не рисует: вся вёрстка живёт в html/css/js, поэтому правка
 * интерфейса не требует трогать пайплайн — ради этого модуль и заводился.
 *
 * Разделение обязанностей:
 *   state   — что выбрано пользователем
 *   apply() — единственное место, где считается «что показывать»
 *   render* — только рисуют, ничего не решают
 */

const $ = (s) => document.querySelector(s);

const state = {
  all: [], meta: null, shown: [],
  layers: {}, collapsed: false, axes: [],
  cmpId: null,          // первая отложенная квартира; вторая берётся из карточки
  rooms: new Set(), market: new Set(), districts: new Set(),
  seller: new Set(), cond: new Set(),
  sort: "p", activeId: null,
};

let map, layer, canvas, canvasOlx, canvasRem, layerCtl, markers = new Map();
// группы слоёв по текущему имени; пересоздаётся при смене языка
const overlaysRef = {};

// ── Форматирование ──────────────────────────────────────────────────────────
const nf = new Intl.NumberFormat("ru-RU");
const money = (v) => (v == null ? "—" : nf.format(Math.round(v)) + " PLN");
const num = (v, unit = "") => (v == null ? "—" : nf.format(Math.round(v)) + unit);

/* ── Переводы ────────────────────────────────────────────────────────────────
 * Строки ИНТЕРФЕЙСА живут здесь: больше их нигде в проекте нет.
 * Подписи осей и GIS-слоёв сюда НЕ дублируются — они приходят в meta.i18n из
 * словаря бота и из карты, иначе три копии разъехались бы при первой правке.
 * Ключи короткие: их читает только этот файл и data-i18n в разметке. */
const T = {
  ru: {
    sort: "Сортировка", s_p: "цена ↑", s_pd: "цена ↓", s_sc: "рейтинг ↓",
    s_ppm: "цена за м² ↑", s_a: "площадь ↓", s_new: "новизна",
    theme_t: "Светлая / тёмная тема", reset: "Сброс", from: "от", to: "до",
    collapse_t: "Свернуть список", expand_t: "Развернуть список",
    f_axes: "Оси рейтинга",
    flt: "Фильтры", flt_n: (n) => `Фильтры · ${n}`, flt_done: "Готово",
    sec_where: "Район", sec_params: "Параметры", sec_type: "Тип квартиры",
    tab_list: "Список", tab_map: "Карта",
    // Формулировка обязана быть про перцентиль, а не про «баллы»: 70 значит
    // «лучше 70% квартир СЕГОДНЯШНЕЙ выдачи», и завтра порог отсечёт другое
    axes_hint: "Показывать квартиры, которые по оси лучше указанного % остальных",
    axes_ph: "лучше %",
    fresh: "Данные обновились после прогона", fresh_btn: "Обновить",
    cmp_pick: "Сравнить", cmp_with: "Сравнить с уже выбранной",
    cmp_drop: "Отменить сравнение", cmp_title: "Сравнение",
    cmp_same: "одинаково", cmp_back: "Закрыть сравнение",
    f_price: "Цена, тыс.", f_area: "Площадь, м²", f_score: "Рейтинг",
    f_commute: "Дорога, мин", f_year: "Год", f_rooms: "Комнаты",
    f_district: "Район", f_market: "Рынок", f_seller: "Продавец", f_cond: "Состояние",
    list_a: "Список квартир", close_a: "Закрыть",
    ut: { private: "Собственник", developer: "Застройщик", agency: "Агентство" },
    mt: { primary: "Первичка", secondary: "Вторичка" },
    cs: { ready_to_use: "Под ключ", to_completion: "Под отделку", to_renovation: "Под ремонт" },
    rooms_s: "комн.", min: "мин",
    rating: "рейтинг", cheaper: "дешевле рынка", pricier: "дороже рынка",
    f_ppm: "Цена за м²", f_area2: "Площадь", f_rooms2: "Комнаты", f_floor: "Этаж",
    f_of: "из", f_year2: "Год", f_seller2: "Продавец", f_market2: "Рынок",
    f_cond2: "Состояние", f_metro: "Метро пешком", f_noise: "Шум",
    f_school: "Школа E8", f_own: "Владение", f_since: "На рынке с",
    f_commute2: "Дорога до дома", noise_lt: "до 55 дБ", db: "дБ", mo: "zł/мес",
    otodom: "Открыть на Otodom", street: "Street View", devall: "Все квартиры ЖК",
    noaddr: "Без адреса", blur: (m) => `пин размыт продавцом (±${m} м) — адрес и рейтинг приблизительны`,
    gaps: (n) => `не указано параметров: ${n}`,
    dist: "Что рядом", pos: "Плюсы", neg: "Минусы", dwait: "расстояния загружаются…",
    rem: "Ранее на продаже", roff: "снято", arch: "Otodom (архив)",
    l_apts: "Квартиры", l_olx: "OLX — собственники", l_rem: "Снятые с продажи",
    l_iso: "Доступность", l_gios: "Качество воздуха PM2.5 (GIOŚ)",
    l_airly: "Качество воздуха PM2.5 (Airly)",
    l_n1: "Шум дорог, сутки", l_n2: "Шум дорог, ночь", l_n3: "Шум ж/д, сутки",
    legend: "PM2.5, µg/м³", err: "Не удалось загрузить данные.",
    m2: "м²", km: "км", m_u: "м", yr: "г.", ppm_u: "zł/м²", metro_s: "метро",
    shown_of: (n, all) => `${n} из ${all}`,
    empty_h: "Ничего не найдено — ослабь фильтры",
    gap_card: (n) => `в объявлении не хватает ${n} парам. — балл менее точен`,
    olx_open: "Открыть на OLX", rem_tip: (n) => `Снято с продажи: ${n}`,
    err_h: "Запусти <code>venv/bin/python 5.web/export.py</code> и открой страницу через локальный сервер.",
  },
  pl: {
    sort: "Sortowanie", s_p: "cena ↑", s_pd: "cena ↓", s_sc: "ocena ↓",
    s_ppm: "cena za m² ↑", s_a: "powierzchnia ↓", s_new: "najnowsze",
    theme_t: "Jasny / ciemny motyw", reset: "Wyczyść", from: "od", to: "do",
    collapse_t: "Zwiń listę", expand_t: "Rozwiń listę",
    f_axes: "Osie oceny",
    flt: "Filtry", flt_n: (n) => `Filtry · ${n}`, flt_done: "Gotowe",
    sec_where: "Dzielnica", sec_params: "Parametry", sec_type: "Typ mieszkania",
    tab_list: "Lista", tab_map: "Mapa",
    axes_hint: "Pokaż mieszkania, które na danej osi są lepsze niż wskazany % pozostałych",
    axes_ph: "lepiej niż %",
    fresh: "Dane zaktualizowane po przebiegu", fresh_btn: "Odśwież",
    cmp_pick: "Porównaj", cmp_with: "Porównaj z już wybranym",
    cmp_drop: "Anuluj porównanie", cmp_title: "Porównanie",
    cmp_same: "tak samo", cmp_back: "Zamknij porównanie",
    f_price: "Cena, tys.", f_area: "Powierzchnia, m²", f_score: "Ocena",
    f_commute: "Dojazd, min", f_year: "Rok", f_rooms: "Pokoje",
    f_district: "Dzielnica", f_market: "Rynek", f_seller: "Sprzedający", f_cond: "Stan",
    list_a: "Lista mieszkań", close_a: "Zamknij",
    ut: { private: "Właściciel", developer: "Deweloper", agency: "Biuro nieruchomości" },
    mt: { primary: "Pierwotny", secondary: "Wtórny" },
    cs: { ready_to_use: "Do zamieszkania", to_completion: "Do wykończenia", to_renovation: "Do remontu" },
    rooms_s: "pok.", min: "min",
    rating: "ocena", cheaper: "taniej niż rynek", pricier: "drożej niż rynek",
    f_ppm: "Cena za m²", f_area2: "Powierzchnia", f_rooms2: "Pokoje", f_floor: "Piętro",
    f_of: "z", f_year2: "Rok", f_seller2: "Sprzedający", f_market2: "Rynek",
    f_cond2: "Stan", f_metro: "Metro pieszo", f_noise: "Hałas",
    f_school: "Szkoła E8", f_own: "Utrzymanie", f_since: "Na rynku od",
    f_commute2: "Dojazd do domu", noise_lt: "do 55 dB", db: "dB", mo: "zł/mies.",
    otodom: "Otwórz na Otodom", street: "Street View", devall: "Wszystkie mieszkania inwestycji",
    noaddr: "Bez adresu", blur: (m) => `pinezka rozmyta przez sprzedającego (±${m} m) — adres i ocena przybliżone`,
    gaps: (n) => `brakujących parametrów: ${n}`,
    dist: "Co w okolicy", pos: "Plusy", neg: "Minusy", dwait: "wczytywanie odległości…",
    rem: "Wcześniej w sprzedaży", roff: "zdjęto", arch: "Otodom (archiwum)",
    l_apts: "Mieszkania", l_olx: "OLX — właściciele", l_rem: "Zdjęte ze sprzedaży",
    l_iso: "Dojazd", l_gios: "Jakość powietrza PM2.5 (GIOŚ)",
    l_airly: "Jakość powietrza PM2.5 (Airly)",
    l_n1: "Hałas drogowy, doba", l_n2: "Hałas drogowy, noc", l_n3: "Hałas kolejowy, doba",
    legend: "PM2.5, µg/m³", err: "Nie udało się wczytać danych.",
    m2: "m²", km: "km", m_u: "m", yr: "r.", ppm_u: "zł/m²", metro_s: "metro",
    shown_of: (n, all) => `${n} z ${all}`,
    empty_h: "Nic nie znaleziono — poluzuj filtry",
    gap_card: (n) => `w ogłoszeniu brakuje ${n} param. — ocena mniej dokładna`,
    olx_open: "Otwórz na OLX", rem_tip: (n) => `Zdjęto ze sprzedaży: ${n}`,
    err_h: "Uruchom <code>venv/bin/python 5.web/export.py</code> i otwórz stronę przez lokalny serwer.",
  },
};

/* Язык: ?lang= из ссылки бота → выбор прошлого визита → русский.
 * Ссылка главнее localStorage: бот шлёт lang= осознанно, под язык подписчика. */
let LANG = (() => {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "pl" || q === "ru") return q;
  try { return localStorage.getItem("wf_lang") || "ru"; } catch { return "ru"; }
})();

/* tr, а не L: L — глобальный объект Leaflet. Короткое имя его затеняло,
 * и падала вся карта разом (L.map переставал быть функцией). */
const tr = (k) => T[LANG][k] ?? T.ru[k] ?? k;
// Подписи осей и слоёв приходят из meta.i18n (словарь бота + карта)
const axisName = (i) => state.meta?.i18n?.[LANG]?.axes?.[i] ?? state.meta.axes[i];
const distName = (ru) => state.meta?.i18n?.[LANG]?.dist?.[ru] ?? ru;

const LABEL = {
  get ut() { return tr("ut"); },
  get mt() { return tr("mt"); },
  get cs() { return tr("cs"); },
};

/** Аннуитетный платёж — те же параметры, что в боте (config.MORTGAGE_*),
 *  чтобы «владение» на сайте и в Telegram совпадало до злотого. */
function monthly(price, cz) {
  const m = state.meta?.mortgage;
  if (!m || !price) return null;
  const loan = price * (1 - m.down), r = m.rate / 12, n = m.years * 12;
  return loan * r / (1 - Math.pow(1 + r, -n)) + (cz || 0);
}

// ── Загрузка ────────────────────────────────────────────────────────────────
async function load() {
  /* Личные зоны — только по токену из ссылки. Нет токена или файл не найден
   * (чужой/устаревший токен) — молча остаёмся без них: фильтр «Дорога» сам
   * спрячется, а карточка не покажет строку про дорогу до дома. */
  const isoTok = new URLSearchParams(location.search).get("iso");
  const isoReq = isoTok && /^[0-9a-f]{6,32}$/.test(isoTok)
    ? fetch(`data/iso/${isoTok}.json?v=${Date.now()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    : Promise.resolve(null);

  /* GitHub Pages отдаёт всё с max-age=600: браузер десять минут не спрашивает
   * сервер вообще, и после прогона страница показывала вчерашние цены.
   *
   * Схема: сперва тянем meta.json МИМО кеша (4 КБ, дёшево), берём из него
   * generated и подставляем как версию ко всем остальным файлам. Пока данные
   * те же — работает обычный кеш; пересобрался пайплайн — версия изменилась,
   * и браузер честно перекачает. Гасить кеш у всех файлов подряд нельзя:
   * это 1.5 МБ квартир на каждое обновление страницы. */
  const meta = await fetch(`data/meta.json?_=${Date.now()}`, { cache: "no-store" })
    .then((r) => r.json());
  const v = encodeURIComponent(meta.generated || "");
  BUILD = v;

  const [apts, layers] = await Promise.all([
    fetch(`data/apartments.json?v=${v}`).then((r) => r.json()),
    fetch(`data/layers.json?v=${v}`).then((r) => r.json()).catch(() => ({})),
  ]);
  state.all = apts;
  state.meta = meta;
  state.layers = layers;
  const iso = await isoReq;
  if (iso) {
    // приводим к тому же виду, что был у общей выгрузки — остальной код не знает
    // и не должен знать, откуда зоны взялись
    state.layers.iso = [{ tok: isoTok, bands: iso.bands }];
    state.layers.tt = { [isoTok]: iso.tt };
  }
  buildFilters();
  measureChrome();
  initGutter();
  watchFreshness();
  readUrl();          // фильтры из ссылки — до первого apply()
  initMap();
  apply();
}

// ── Фильтры ─────────────────────────────────────────────────────────────────
/* Кнопки чипов в реестре: URL умеет их не только читать, но и включать.
 * Ключ — имя набора в state (rooms/market/seller/cond). */
const chipBtns = {};

function chip(host, label, value, set, name) {
  (chipBtns[name] ||= {})[value] = null;
  const b = document.createElement("button");
  b.className = "chip";
  chipBtns[name][value] = b;
  b.textContent = label;
  b.setAttribute("aria-pressed", "false");
  b.onclick = () => {
    const on = b.getAttribute("aria-pressed") === "true";
    b.setAttribute("aria-pressed", String(!on));
    on ? set.delete(value) : set.add(value);
    apply();
  };
  host.appendChild(b);
}

function buildFilters() {
  ["3", "4", "5+"].forEach((r) => chip($("#f-rooms"), r, r === "5+" ? "5" : r, state.rooms, "rooms"));
  Object.entries(LABEL.mt).forEach(([k, v]) => chip($("#f-market"), v, k, state.market, "market"));
  Object.entries(LABEL.ut).forEach(([k, v]) => chip($("#f-seller"), v, k, state.seller, "seller"));
  Object.entries(LABEL.cs).forEach(([k, v]) => chip($("#f-cond"), v, k, state.cond, "cond"));

  const sel = $("#f-district");
  sel.size = 1;
  state.meta.districts.forEach((d) => sel.add(new Option(d, d)));
  sel.onchange = () => {
    state.districts = new Set([...sel.selectedOptions].map((o) => o.value));
    apply();
  };

  buildAxisFilters();

  /* «Дорога, мин» есть только в личной сборке: в публичной изохрон нет, и
   * фильтр по ним отсеял бы всё в ноль. Прячем поле, а не оставляем мёртвым. */
  if (!hasCommute()) {
    const f = $("#f-tmax");
    f.value = "";
    f.disabled = true;                              // само поле — не только подпись
    f.closest("label")?.setAttribute("hidden", ""); // подпись целиком, если есть
  }

  // Год постройки: границы из данных, чтобы плейсхолдер не врал про диапазон
  const [ymin, ymax] = state.meta.ranges.year;
  $("#f-ymin").placeholder = `${tr("from")} ${ymin}`;
  $("#f-ymax").placeholder = `${tr("to")} ${ymax}`;

  ["#f-pmin", "#f-pmax", "#f-amin", "#f-amax", "#f-smin", "#f-tmax",
   "#f-ymin", "#f-ymax", "#f-smax"].forEach((id) => {
    $(id).oninput = apply;
  });
  $("#sort").onchange = (e) => { state.sort = e.target.value; apply(); };
  $("#reset").onclick = () => {
    document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
    state.rooms.clear(); state.market.clear(); state.districts.clear();
    state.seller.clear(); state.cond.clear();
    [...sel.options].forEach((o) => (o.selected = false));
    ["#f-pmin", "#f-pmax", "#f-amin", "#f-amax", "#f-smin", "#f-tmax",
     "#f-ymin", "#f-ymax", "#f-smax", ...axIds()].forEach((id) => ($(id).value = ""));
    apply();
  };
  $("#theme").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("wf_theme", next); } catch {}
  };
  $("#sheet-close").onclick = () => { $("#sheet").hidden = true; };

  /* На телефоне блок сортировки скрыт в шапке (места нет) — переносим ТОТ ЖЕ
   * узел внутрь панели фильтров, а не дублируем: два элемента с одним id
   * сломали бы и разметку, и обработчики. */
  const moveSort = () => {
    const sortBox = document.querySelector(".sort");
    const filters = $("#filters");
    if (!sortBox || !filters) return;
    const narrow = window.innerWidth <= 700;
    const inFilters = sortBox.parentElement === filters;
    if (narrow && !inFilters) filters.insertBefore(sortBox, filters.firstChild);
    else if (!narrow && inFilters) document.querySelector(".top-right")
      .insertBefore(sortBox, $("#flt-toggle"));
  };
  moveSort();
  window.addEventListener("resize", moveSort);

  /* Телефон: список и карта — ВКЛАДКИ, а не две полосы одного экрана.
   * Делить 6-дюймовый экран между ними бессмысленно: обе половины неудобны.
   * На широком экране вкладки скрыты (CSS), там работает разделитель. */
  const showTab = (which) => {
    document.body.classList.toggle("tab-map", which === "map");
    $("#tab-list").setAttribute("aria-selected", String(which !== "map"));
    $("#tab-map").setAttribute("aria-selected", String(which === "map"));
    // Leaflet мерит контейнер при инициализации; пока карта была скрыта,
    // её размер равен нулю — без пересчёта она останется серой
    if (which === "map") setTimeout(() => map?.invalidateSize(), 0);
    else { rowMeasured = 0; paintWindow(); }
  };
  $("#tab-list").onclick = () => showTab("list");
  $("#tab-map").onclick = () => showTab("map");

  $("#flt-done").onclick = () => {
    document.body.classList.remove("flt-open");
    refreshFilterBtn();
    setTimeout(measureChrome, 0);
  };

  $("#flt-toggle").onclick = () => {
    document.body.classList.toggle("flt-open");
    refreshFilterBtn();
    setTimeout(measureChrome, 210);   // полоса появилась/исчезла — верх шторки другой
  };

  $("#collapse").onclick = () => setCollapsed(!state.collapsed);
  // выбор прошлого визита: свернул список — он и остался свёрнутым
  try { if (localStorage.getItem("wf_collapsed") === "1") setCollapsed(true); } catch {}

  $("#lang").onclick = () => setLang(LANG === "ru" ? "pl" : "ru");
  applyLang();
}

/* ── Переключение языка ──────────────────────────────────────────────────────
 * Перерисовываем всё, что уже отрендерено: статическую разметку по data-i18n,
 * чипы, контрол слоёв и список. Старая карта переводила готовый HTML регулярками
 * (plTx) — отсюда росли баги с чекбоксами Leaflet, которые ловились неделю.
 * Здесь текста в разметке нет вообще: есть ключ, есть словарь. */
function setLang(l) {
  LANG = l;
  try { localStorage.setItem("wf_lang", l); } catch {}
  // lang= в адресе: ссылка должна открыться на том же языке
  const q = new URLSearchParams(location.search);
  q.set("lang", l);
  history.replaceState(null, "", `?${q}`);
  applyLang();
  apply();                 // список, счётчик и маркеры — с новыми подписями
}

function applyLang() {
  document.documentElement.lang = LANG;
  $("#lang").textContent = LANG === "ru" ? "PL" : "RU";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = tr(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = tr(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = tr(el.dataset.i18nPh);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", tr(el.dataset.i18nAria));
  });

  refreshCollapseBtn();
  refreshFilterBtn();
  setTimeout(measureChrome, 0);   // подписи сменились — полоса могла перенестись
  if (state.meta) {
    const keep = axIds().map((id) => $(id)?.value ?? "");
    buildAxisFilters();
    axIds().forEach((id, i) => { if ($(id)) $(id).value = keep[i]; });
  }
  rowMeasured = 0;    // подписи другого языка могут менять переносы и высоту
  rebuildChips();
  if (map) rebuildLayerControl();
}

/* Чипы пересобираем целиком: подписи меняются, а выбранные значения должны
 * пережить смену языка — они лежат в state, не в кнопках. */
function rebuildChips() {
  [["#f-rooms", "rooms"], ["#f-market", "market"],
   ["#f-seller", "seller"], ["#f-cond", "cond"]].forEach(([host, name]) => {
    $(host).innerHTML = "";
    delete chipBtns[name];
  });
  ["3", "4", "5+"].forEach((r) => chip($("#f-rooms"), r, r === "5+" ? "5" : r, state.rooms, "rooms"));
  Object.entries(LABEL.mt).forEach(([k, v]) => chip($("#f-market"), v, k, state.market, "market"));
  Object.entries(LABEL.ut).forEach(([k, v]) => chip($("#f-seller"), v, k, state.seller, "seller"));
  Object.entries(LABEL.cs).forEach(([k, v]) => chip($("#f-cond"), v, k, state.cond, "cond"));
  // вернуть нажатое состояние из state
  Object.entries(chipBtns).forEach(([name, btns]) =>
    Object.entries(btns).forEach(([v, b]) =>
      b.setAttribute("aria-pressed", String(state[name].has(v)))));
}

/* Названия слоёв запечены в контроле, поэтому его пересоздаём. Какие слои
 * были включены — запоминаем по объекту группы, а не по имени: имя как раз
 * и меняется. */
function rebuildLayerControl() {
  /* Запоминаем включённые слои по ПОРЯДКОВОМУ НОМЕРУ, а не по объекту:
   * buildDataLayers() создаёт группы заново, и старые объекты в новом наборе
   * не встречаются. Раньше сравнение шло по объекту — включённые слои
   * оставались нарисованными на карте, но в новом контроле числились
   * выключенными: галка снята, метки видны, повторное включение рисовало
   * вторую копию. Со стороны это выглядело как «слой отвалился». */
  const prev = Object.keys(overlaysRef).filter((k) => k !== "__wms");
  const onIdx = new Set();
  prev.forEach((k, i) => { if (map.hasLayer(overlaysRef[k])) onIdx.add(i); });

  // старые группы убираем с карты — иначе останутся поверх новых навсегда
  prev.forEach((k) => map.removeLayer(overlaysRef[k]));

  layerCtl?.remove();
  buildLayerControl();

  Object.keys(overlaysRef).filter((k) => k !== "__wms")
    .forEach((k, i) => { if (onIdx.has(i)) overlaysRef[k].addTo(map); });
}

/* Свернуть список — карта на всю ширину. Leaflet считает размер контейнера
 * при инициализации и сам не замечает, что тот стал шире: без invalidateSize
 * половина карты осталась бы серой. Ждём конца перехода, иначе замер попадёт
 * на середину анимации. */
function setCollapsed(on) {
  state.collapsed = on;
  document.body.classList.add("animating");
  document.body.classList.toggle("collapsed", on);
  setTimeout(() => document.body.classList.remove("animating"), 260);
  refreshCollapseBtn();
  try { localStorage.setItem("wf_collapsed", on ? "1" : "0"); } catch {}
  setTimeout(() => {
    map?.invalidateSize();
    if (!on) { rowMeasured = 0; paintWindow(); }   // ширина другая → перенос строк другой
  }, 210);
}

/* Подпись кнопки зависит и от состояния, и от языка, поэтому её нельзя
 * помечать статическим data-i18n-title: applyLang перетирала бы «развернуть»
 * на «свернуть» при каждой смене языка. Обновляем из одного места. */
/* На телефоне полоса фильтров переносилась в 5-6 рядов и съедала весь экран.
 * Прячем её за кнопкой; на широком экране кнопка не показывается вовсе (CSS). */
function refreshFilterBtn() {
  const b = $("#flt-toggle");
  if (!b) return;
  // Только слово. Ни счётчика, ни подсветки: «Фильтры · 15» распирало шапку,
  // а заливка спорила с вкладками, где она означает «раздел открыт».
  b.textContent = tr("flt");
  b.setAttribute("aria-expanded", String(document.body.classList.contains("flt-open")));
}

function refreshCollapseBtn() {
  const b = $("#collapse");
  if (!b) return;
  b.setAttribute("aria-pressed", String(state.collapsed));
  b.textContent = state.collapsed ? "▣" : "◧";
  b.title = tr(state.collapsed ? "expand_t" : "collapse_t");
}

/* Пять порогов по осям рейтинга. Поля строим в JS, а не в разметке: подписи
 * приходят из meta.i18n (общий словарь с ботом) и меняются вместе с языком. */
function buildAxisFilters() {
  const box = $("#f-axes").querySelector(".axf-box");
  box.innerHTML = "";

  const hint = document.createElement("p");
  hint.className = "axf-hint";
  hint.textContent = tr("axes_hint");
  box.appendChild(hint);

  // Узлами, а не строкой innerHTML: подписи осей приходят из данных, и
  // textContent снимает вопрос экранирования раз и навсегда
  (state.meta.axes || []).forEach((_, i) => {
    const row = document.createElement("label");
    row.className = "axf-row";

    const name = document.createElement("span");
    name.textContent = axisName(i);

    const inp = document.createElement("input");
    inp.type = "number";
    inp.id = `f-ax${i}`;
    inp.min = "0";
    inp.max = "100";
    inp.placeholder = tr("axes_ph");
    inp.oninput = apply;

    row.appendChild(name);
    row.appendChild(inp);
    box.appendChild(row);
  });
}

const axIds = () => (state.meta.axes || []).map((_, i) => `#f-ax${i}`);

const val = (id) => { const v = $(id).value; return v === "" ? null : +v; };

/* Есть ли вообще данные о времени в пути. В публичной сборке их нет (адрес не
 * выгружается), и фильтр по ним обнулил бы выдачу — в том числе по ссылке с
 * ?commute=30, где поле спрятано и человек не понял бы, почему пусто. */
const hasCommute = () =>
  !!state.layers?.tt && Object.keys(state.layers.tt).length > 0;

/* ── Синхронизация фильтров с URL ────────────────────────────────────────────
 * Имена параметров — контракт со старой картой и ботом (_filter_to_query
 * в 4.bot/notifier.py). Менять их нельзя: по этим ссылкам ходят подписчики.
 * Осторожно с асимметрией — она историческая, но живая:
 *   price     = МАКСИМУМ цены, в ТЫСЯЧАХ;  price_min — минимум, тоже в тысячах
 *   area      = МИНИМУМ площади;           area_max  — максимум
 *   score/year = МИНИМУМ;                  score_max/year_max — максимум
 * commute — наш новый параметр, в старой карте его нет. */
const URL_NUM = [
  ["price_min", "#f-pmin"], ["price",     "#f-pmax"],
  ["area",      "#f-amin"], ["area_max",  "#f-amax"],
  ["score",     "#f-smin"], ["score_max", "#f-smax"],
  ["year",      "#f-ymin"], ["year_max",  "#f-ymax"],
  ["commute",   "#f-tmax"],
  // ax0..ax4 — позиционные, как ax_0..ax_4 в БД и порядок SCORE_AXES
  ...[0, 1, 2, 3, 4].map((i) => [`ax${i}`, `#f-ax${i}`]),
];
const URL_SET = [["rooms", "rooms"], ["mt", "market"], ["ut", "seller"], ["cs", "cond"]];

function readUrl() {
  const q = new URLSearchParams(location.search);
  URL_NUM.forEach(([k, id]) => { if (q.get(k)) $(id).value = q.get(k); });

  URL_SET.forEach(([k, name]) => {
    (q.get(k) || "").split(",").filter(Boolean).forEach((v) => {
      state[name].add(v);
      // кнопка есть не всегда: район из ссылки может отсутствовать в выдаче дня
      chipBtns[name]?.[v]?.setAttribute("aria-pressed", "true");
    });
  });

  const sel = $("#f-district");
  (q.get("district") || "").split(",").filter(Boolean).forEach((d) => {
    state.districts.add(d);
    [...sel.options].forEach((o) => { if (o.value === d) o.selected = true; });
  });
}

function syncUrl() {
  const p = new URLSearchParams();
  URL_NUM.forEach(([k, id]) => { if ($(id).value !== "") p.set(k, $(id).value); });
  URL_SET.forEach(([k, name]) => { if (state[name].size) p.set(k, [...state[name]].join(",")); });
  if (state.districts.size) p.set("district", [...state.districts].join(","));

  // Токен изохрон, язык и анти-кеш переживают перезапись: они не фильтры,
  // но теряются, если просто затереть строку запроса (баг старой карты с v=)
  const cur = new URLSearchParams(location.search);
  ["iso", "lang", "v"].forEach((k) => { if (cur.get(k)) p.set(k, cur.get(k)); });

  const qs = p.toString();
  // replaceState, а не push: фильтры не должны засорять историю «Назад»
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

/** Единственное место, где решается «что показывать». Фильтр по полю с
 *  отсутствующим значением исключает квартиру — как в боте: активный
 *  фильтр не должен пропускать то, про что мы ничего не знаем. */
function apply() {
  const pmin = val("#f-pmin"), pmax = val("#f-pmax");
  const amin = val("#f-amin"), amax = val("#f-amax");
  const smin = val("#f-smin"), smax = val("#f-smax");
  const tmax = val("#f-tmax");   // минут пешком+транспортом до личного адреса
  const ymin = val("#f-ymin"), ymax = val("#f-ymax");
  // пороги по осям: null = ось не ограничена
  const axMin = axIds().map(val);

  state.shown = state.all.filter((a) => {
    if (pmin != null && !(a.p != null && a.p >= pmin * 1000)) return false;
    if (pmax != null && !(a.p != null && a.p <= pmax * 1000)) return false;
    if (amin != null && !(a.a != null && a.a >= amin)) return false;
    if (amax != null && !(a.a != null && a.a <= amax)) return false;
    if (smin != null && !(a.sc != null && a.sc >= smin)) return false;
    if (smax != null && !(a.sc != null && a.sc <= smax)) return false;
    // дорога до дома: те же минуты, по которым строятся зоны 15/30/45 на карте
    if (tmax != null && hasCommute()) {
      const t = commute(a.id);
      if (t == null || t > tmax) return false;
    }
    if (state.rooms.size && !(a.r != null && matchRooms(a.r))) return false;
    if (ymin != null && !(a.by != null && a.by >= ymin)) return false;
    if (ymax != null && !(a.by != null && a.by <= ymax)) return false;
    // Ось без значения не проходит активный порог — как и все прочие поля:
    // фильтруешь по зелени, квартиры без оценки зелени скрываются
    for (let i = 0; i < axMin.length; i++) {
      if (axMin[i] == null) continue;
      if (!(a.ax?.[i] != null && a.ax[i] >= axMin[i])) return false;
    }
    if (state.market.size && !state.market.has(a.mt)) return false;
    if (state.seller.size && !state.seller.has(a.ut)) return false;
    if (state.cond.size && !state.cond.has(a.cs)) return false;
    if (state.districts.size && !state.districts.has(a.d)) return false;
    return true;
  });

  const key = state.sort.replace("-", ""), desc = state.sort.startsWith("-");
  state.shown.sort((x, y) => {
    const a = x[key], b = y[key];
    if (a == null) return 1;            // нет данных — всегда в конец
    if (b == null) return -1;
    return desc ? (a < b ? 1 : -1) : (a > b ? 1 : -1);
  });

  // На телефоне «1 957 из 1 957» съедало 100 px шапки — там показываем одно число
  $("#count").textContent = window.innerWidth <= 700
    ? nf.format(state.shown.length)
    : tr("shown_of")(nf.format(state.shown.length), nf.format(state.all.length));
  renderList();
  /* Выбранная квартира могла выпасть из выдачи новым фильтром. Её карточка
   * висела бы поверх списка, в котором её уже нет, и маркера на карте тоже —
   * а activeId продолжал бы жить и подсвечивать её при возврате фильтра.
   * Состояние не должно переживать то, что его породило. */
  if (state.activeId && !state.shown.some((a) => a.id === state.activeId)) {
    state.activeId = null;
    $("#sheet").hidden = true;
  }

  renderMarkers();
  refreshFilterBtn();
  syncUrl();
}

const matchRooms = (r) => [...state.rooms].some((v) => (v === "5" ? r >= 5 : r === +v));

// ── Список ──────────────────────────────────────────────────────────────────
/* Шкалы рейтинга. withScore=true добавляет ПЕРВОЙ строкой общий рейтинг —
 * в списке иначе видно только оси, а итогового числа нет. В карточке объекта
 * он не нужен: там рейтинг и так написан цифрой над шкалами.
 *
 * Общая шкала — та же величина (0-100) и тот же цвет, отличается подписью и
 * разделителем: это сумма осей, а не шестая ось. */
function axesHtml(a, withScore = false) {
  if (!a.ax || a.ax.every((v) => v == null)) return "";

  const bar = (name, v, cls = "") =>
    `<span class="ax-name ${cls}">${name}</span>
     <span class="ax-track ${cls}"><span class="ax-fill" style="width:${v}%"></span></span>
     <span class="ax-val ${cls}">${v}</span>`;

  const head = withScore && a.sc != null
    ? bar(esc(tr("f_score")), Math.round(a.sc), "ax-total") : "";

  // подпись оси — из meta.i18n (словарь бота), не из локального словаря
  const rows = state.meta.axes.map((_, i) => {
    const v = a.ax[i];
    return v == null ? "" : bar(esc(axisName(i)), v);
  }).join("");

  return `<div class="axes">${head}${rows}</div>`;
}

function fairHtml(a) {
  if (a.fp == null || Math.abs(a.fp) < 5) return "";
  const cheap = a.fp < 0;
  // Знак и слово обязательны: цвет один смысла не несёт
  return `<span class="fair ${cheap ? "good" : "bad"}">${cheap ? "▼" : "▲"} ${Math.abs(Math.round(a.fp))}% ${cheap ? tr("cheaper") : tr("pricier")}</span>`;
}

function cardHtml(a) {
  const loc = [a.d, a.st].filter(Boolean).join(", ") || "—";
  const sub = [
    `${num(a.a, " " + tr("m2"))}`,
    `${a.r ?? "?"} ${tr("rooms_s")}`,
    a.by ? `${a.by} ${tr("yr")}` : null,
    a.ppm ? `${nf.format(Math.round(a.ppm))} ${tr("ppm_u")}` : null,
    a.wm != null ? `${tr("metro_s")} ${a.wm} ${tr("min")}` : null,
  ].filter(Boolean).join(' <span class="sep">·</span> ');

  return `<article class="card" data-id="${a.id}" ${a.id === state.activeId ? 'data-active="1"' : ""}>
    <div class="card-head">
      <span class="loc">${esc(loc)}</span>
      <button class="cmp-btn card-cmp" data-cmp="${a.id}"
              aria-pressed="${state.cmpId === a.id}">${
        esc(tr(state.cmpId === a.id ? "cmp_drop"
             : state.cmpId ? "cmp_with" : "cmp_pick"))}</button>
      <span class="price">${money(a.p)}</span>
    </div>
    <div class="card-sub">${sub} ${fairHtml(a)}</div>
    ${axesHtml(a, true)}
    ${a.gap ? `<div class="gap-note">${tr("gap_card")(a.gap)}</div>` : ""}
  </article>`;
}

/* Виртуализация: в DOM живут только карточки видимого окна плюс запас.
 * 2000 карточек × ~20 узлов = 40 000 элементов — браузер начинает заикаться на
 * прокрутке и фильтрации. Держим ~40 и подменяем их при скролле; общая высота
 * задаётся распорками сверху и снизу, поэтому полоса прокрутки честная. */
/* Высоту строки НЕ хардкодим: она зависит от шрифта, масштаба страницы и от
 * того, есть ли у карточки примечание о неполных данных (у 18% есть). Считали
 * её равной 132 px — реально ~186, и полоса прокрутки выходила на треть короче
 * содержимого, а окно карточек уезжало от того места, куда прокрутил.
 * Стартовое значение — только чтобы нарисовать первый экран; дальше меряем. */
let rowH = 180;
let rowMeasured = 0;        // сколько раз уточняли: страховка от зацикливания
const OVERSCAN = 6;         // запас сверху/снизу, чтобы не мигало при быстрой прокрутке

/* Средний шаг между карточками по факту. Берём разницу offsetTop крайних, а не
 * высоту одной: так в среднее попадают и высокие карточки с примечанием. */
function measureRow(host) {
  if (rowMeasured > 3) return false;
  const cards = host.querySelectorAll(".card");
  if (cards.length < 2) return false;
  const step = (cards[cards.length - 1].offsetTop - cards[0].offsetTop) / (cards.length - 1);
  if (!(step > 20) || Math.abs(step - rowH) <= 2) return false;
  rowH = step;
  rowMeasured++;
  return true;
}

function renderList() {
  const host = $("#list");
  if (!state.shown.length) {
    host.innerHTML = `<p class="empty">${tr("empty_h")}</p>`;
    return;
  }
  if (!host.dataset.virt) {
    host.dataset.virt = "1";
    host.addEventListener("scroll", () => paintWindow(), { passive: true });
  }
  host.scrollTop = 0;
  paintWindow();
}

function paintWindow() {
  const host = $("#list");
  const total = state.shown.length;
  const first = Math.max(0, Math.floor(host.scrollTop / rowH) - OVERSCAN);
  const fit = Math.ceil(host.clientHeight / rowH) + OVERSCAN * 2;
  const last = Math.min(total, first + fit);

  const padTop = first * rowH;
  const padBottom = Math.max(0, (total - last) * rowH);
  host.innerHTML =
    `<div style="height:${padTop}px;flex:none"></div>` +
    state.shown.slice(first, last).map(cardHtml).join("") +
    `<div style="height:${padBottom}px;flex:none"></div>`;

  host.querySelectorAll(".card").forEach((el) => {
    el.onclick = (e) => {
      // Кнопка сравнения внутри карточки: не даём клику всплыть и открыть шторку
      const c = e.target.closest?.(".card-cmp");
      if (c) { e.stopPropagation(); return pickCompare(c.dataset.cmp); }
      select(el.dataset.id, true);
    };
  });

  // Первая отрисовка даёт настоящую высоту — перерисовываем с ней один раз
  if (measureRow(host)) paintWindow();
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ── Карта ───────────────────────────────────────────────────────────────────
/* Слои-подложки. Шум — официальная акустическая карта Варшавы 2022 (WMS).
 * В старой карте они жили внутри контрола Leaflet, вкрученного в самодельный
 * док, — оттуда и росли баги с чекбоксами. Здесь это обычный контрол Leaflet,
 * ничего не переносим и не пересобираем. */
const WMS = "https://wms.um.warszawa.pl/serwis";
const OVERLAYS = [
  ["l_n1", "HALAS_DROGOWY_LDWN_2022"],
  ["l_n2", "HALAS_DROGOWY_LN_2022"],
  ["l_n3", "HALAS_KOLEJOWY_LDWN_2022"],
];

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([52.23, 21.01], 11);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap, &copy; CARTO", maxZoom: 19,
  }).addTo(map);
  layer = L.layerGroup().addTo(map);

  /* Порядок отрисовки задаём панелями, а не порядком добавления слоёв:
   * включил-выключил слой — и порядок бы поехал. Снизу вверх:
   * снятые (история) → OLX (чужая площадка) → наши квартиры сверху.
   * Полигоны (изохроны, воздух) остаются в overlayPane = 400, то есть ниже.
   * У каждой панели свой canvas: один общий рисовал бы всё в порядке
   * добавления и панели бы не разделились. */
  [["pRemoved", 410], ["pOlx", 420], ["pApts", 430]].forEach(([name, z]) => {
    map.createPane(name).style.zIndex = z;
  });
  // padding — чтобы точки у края не пропадали при панораме до перерисовки
  canvas = L.canvas({ pane: "pApts", padding: 0.3 });
  canvasOlx = L.canvas({ pane: "pOlx", padding: 0.3 });
  canvasRem = L.canvas({ pane: "pRemoved", padding: 0.3 });

  buildLayerControl();
  initAirLegend();
}

/* Контрол слоёв собирается отдельно, потому что при смене языка его нужно
 * пересоздать: имена слоёв запечены в нём при создании. Сами группы слоёв
 * при этом переиспользуются — иначе включённые слои гасли бы на переключении. */
function buildLayerControl() {
  const wms = overlaysRef.__wms ||= OVERLAYS.map(([, name]) =>
    L.tileLayer.wms(WMS, {
      layers: name, format: "image/png", transparent: true, version: "1.3.0",
      opacity: 0.55, attribution: "Mapa akustyczna Warszawy 2022",
    }));

  const named = { [tr("l_apts")]: layer, ...buildDataLayers() };
  OVERLAYS.forEach(([key], i) => { named[tr(key)] = wms[i]; });

  // ссылки на группы для rebuildLayerControl (какие были включены)
  Object.keys(overlaysRef).forEach((k) => { if (k !== "__wms") delete overlaysRef[k]; });
  Object.assign(overlaysRef, named);

  layerCtl = L.control.layers(null, named, { collapsed: true }).addTo(map);
}

/* Слои из layers.json. Собственники OLX, качество воздуха и персональные
 * изохроны — то, что в старой карте запекалось прямо в HTML. Здесь это данные,
 * поэтому слой можно включить, выключить и переписать, не пересобирая страницу.
 *
 * Порядок вставки = порядок в контроле Leaflet, поэтому он задан явно и
 * повторяет старую карту: сначала наши квартиры, потом справочные слои. */

// Польский индекс качества воздуха PM2.5 (µg/m³): порог → цвет.
// Это регламентированная шкала, а не наша — цвета взяты как есть из
// 3.map/map_generator.py, чтобы одно и то же значение не красилось по-разному.
// GIOŚ и Airly меряют одну величину, поэтому шкала у них общая.
const PM25_BANDS = [[13, "#57b108"], [35, "#b0dd10"], [55, "#ffd911"],
                    [75, "#e58100"], [110, "#e50000"], [Infinity, "#990000"]];
const pm25Color = (v) => PM25_BANDS.find(([thr]) => v <= thr)[1];

/* Слой воздуха: опционально векторная поверхность (полосы индекса), поверх
 * неё — сами сенсоры. Порядок важен: полигоны кладём первыми, иначе они
 * перекроют точки и по ним нельзя будет получить подсказку. */
function airGroup(pts, radius, bands) {
  const g = L.layerGroup();

  // От чистого к грязному — грязное поверх, как в старой карте
  (bands || []).forEach((b) => {
    L.geoJSON(b.geo, {
      interactive: false,
      // граница той же краской: полосы соседних уровней иначе сливаются в пятно
      style: { fillColor: b.color, color: b.color, weight: 1.5, opacity: .9, fillOpacity: .3 },
    }).addTo(g);
  });

  pts.forEach((p) => {
    const pm10 = p.pm10 != null ? ` · PM10: ${Math.round(p.pm10)}` : "";
    L.circleMarker([p.lat, p.lon], {
      radius, weight: 1, color: "#555",
      fillColor: pm25Color(p.v), fillOpacity: .95,
    }).bindTooltip(`${esc(p.addr || "")} · PM2.5: ${p.v} µg/m³${pm10}${p.hh ? ` (${p.hh})` : ""}`)
      .addTo(g);
  });
  return g;
}

function buildDataLayers() {
  const L_ = state.layers || {};
  const out = {};

  /* Порядок вставки = порядок в контроле Leaflet. Сначала то, что показывает
   * предложения (наши квартиры вставлены до вызова этой функции, дальше OLX
   * и снятые), потом справочные слои — воздух, изохроны, шум. */

  // OLX: продажа от собственников. Кросспосты с Otodom отфильтрованы в export.py
  if (L_.olx?.length) {
    const g = L.layerGroup();
    L_.olx.forEach((o) => {
      L.circleMarker([o.lat, o.lon], {
        renderer: canvasOlx, pane: "pOlx",
        radius: 5, weight: 2, color: "#fcfcfb", fillColor: "#4a3aa7", fillOpacity: .85,
      }).bindTooltip(`OLX · ${money(o.p)} · ${num(o.a, " " + tr("m2"))}`)
        .bindPopup(`<b>${esc(o.t)}</b><br>${money(o.p)} · ${num(o.a, " " + tr("m2"))} · ${o.r ?? "?"} ${tr("rooms_s")}
                    <br><a href="${esc(o.u)}" target="_blank" rel="noopener">${tr("olx_open")}</a>`)
        .addTo(g);
    });
    out[`${tr("l_olx")} · ${L_.olx.length}`] = g;
  }

  /* Снятые с продажи — только те адреса, где активных объявлений не осталось.
   * Где активные есть, снятые видны в их карточке, и вторая метка была бы
   * дублем. Метки приглушённые: это история, а не предложение. */
  if (L_.removed_pts?.length) {
    const g = L.layerGroup();
    L_.removed_pts.forEach((r) => {
      L.circleMarker([r.lat, r.lon], {
        renderer: canvasRem, pane: "pRemoved", radius: 4, weight: 1,
        color: "#8b8a81", fillColor: "#8b8a81", fillOpacity: .5,
      }).bindTooltip(tr("rem_tip")(r.n)).addTo(g);
    });
    out[`${tr("l_rem")} · ${L_.removed_pts.length}`] = g;
  }

  // Изохроны: зоны доступности от личного адреса подписчика
  (L_.iso || []).forEach((entry) => {
    const g = L.layerGroup();
    entry.bands.forEach((b) => {
      L.geoJSON(b.geo, {
        interactive: false,
        style: { color: b.color, fillColor: b.color, weight: 2, opacity: .9, fillOpacity: .22 },
      }).addTo(g);
    });
    out[`${tr("l_iso")} ${entry.bands.map((b) => b.min).join("/")} ${tr("min")}`] = g;
  });

  // Госстанции: их мало, поэтому кружок крупнее — это опорные точки
  if (L_.gios?.length) out[tr("l_gios")] = airGroup(L_.gios, 11);
  // Airly: плотная сеть бытовых сенсоров + интерполяционная поверхность
  if (L_.air?.length)
    out[tr("l_airly")] = airGroup(L_.air, 5, L_.air_bands);

    return out;
}

/* Легенда PM2.5. Шкала из шести полос, где цвет и есть смысл, — без подписи
 * её не прочитать. Показываем только когда включён хоть один слой воздуха. */
function initAirLegend() {
  const box = L.DomUtil.create("div", "legend");
  box.innerHTML = `<b>${tr("legend")}</b>` + [
    ["0–13", 0], ["13–35", 1], ["35–55", 2], ["55–75", 3], ["75–110", 4], ["&gt;110", 5],
  ].map(([lbl, i]) =>
    `<span><i style="background:${PM25_BANDS[i][1]}"></i>${lbl}</span>`).join("");

  const ctl = L.control({ position: "bottomright" });
  ctl.onAdd = () => box;

  let on = 0;
  const isAir = (e) => /PM2\.5/.test(e.name);
  map.on("overlayadd",    (e) => { if (isAir(e) && !on++) ctl.addTo(map); });
  map.on("overlayremove", (e) => { if (isAir(e) && !--on) ctl.remove(); });
}

/* Рисуем ВСЕ отфильтрованные квартиры, без потолка.
 * Раньше стоял slice(0, 800) «ради скорости» — и это читалось как баг карты:
 * при сортировке по цене в 800 дешёвых попадали окраины, центр оставался
 * пустым, а любой фильтр менял состав выборки и центр внезапно «появлялся».
 * Обрезать выдачу молча нельзя: карта обязана показывать то же, что список.
 * Скорость держит canvas-рендерер — две тысячи точек он тянет без нагрузки,
 * в отличие от SVG, где каждая точка это отдельный элемент DOM. */
function renderMarkers() {
  layer.clearLayers();
  markers.clear();
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent").trim();
  // Размер точки кратен рейтингу: величина в размере, а не в цвете
  state.shown.forEach((a) => {
    if (a.lat == null) return;
    const r = 4 + (a.sc ?? 0) / 100 * 6;
    const m = L.circleMarker([a.lat, a.lon], {
      renderer: canvas, pane: "pApts",
      radius: r, weight: 2, color: "#fcfcfb",
      fillColor: accent, fillOpacity: .85,
    }).addTo(layer);
    m.bindTooltip(`${money(a.p)} · ${num(a.a, " " + tr("m2"))} · ${tr("rating")} ${Math.round(a.sc)}`);
    m.on("click", () => select(a.id, false));
    markers.set(a.id, m);
  });
  // после смены фильтров маркеры пересозданы — гало тоже надо вернуть
  if (state.activeId) highlightMarker(state.activeId);
}

// ── Выбор квартиры ──────────────────────────────────────────────────────────
/* ── Выбор квартиры ──────────────────────────────────────────────────────────
 * Три вещи должны совпасть: карточка в списке подсвечена, список прокручен к
 * ней, маркер на карте выделен. Раньше каждая работала через раз. */
function select(id, fromList) {
  state.activeId = id;
  const a = state.all.find((x) => x.id === id);
  if (!a) return;

  if (fromList && a.lat != null) {
    map.setView([a.lat, a.lon], Math.max(map.getZoom(), 15));
  }
  // Прокручиваем не «когда клик был с карты», а когда карточки НЕ ВИДНО.
  // Клик из списка обычно виден и так, но после сравнения, смены языка или
  // возврата фильтра выбранная может оказаться далеко за пределами окна.
  scrollListTo(id);

  // Подсветку карточки даёт ПЕРЕРИСОВКА окна, а не правка атрибута: карточки
  // может не быть в DOM (виртуализация), а toggleAttribute ставил data-active=""
  // вместо "1", и селектор [data-active="1"] не срабатывал вовсе
  paintWindow();
  highlightMarker(id);
  openSheet(a);
}

/* Прокрутка к карточке по НОМЕРУ в выдаче, а не через scrollIntoView: нужного
 * узла в DOM обычно нет — в окне живут ~40 карточек из двух тысяч. Считаем
 * позицию сами и перерисовываем окно. */
function scrollListTo(id) {
  const host = $("#list");
  const idx = state.shown.findIndex((x) => x.id === id);
  if (idx < 0) return;                       // квартира вне текущего фильтра

  const top = idx * rowH;
  const seen = host.scrollTop;
  // уже целиком в окне — не дёргаем прокрутку под рукой у человека
  if (top >= seen && top + rowH <= seen + host.clientHeight) return;

  host.scrollTop = Math.max(0, top - (host.clientHeight - rowH) / 2);
}

/* Выделение маркера. При двух тысячах точек «где я» иначе не понять.
 * Гало отдельным кругом под маркером: увеличить сам маркер мало — в плотной
 * застройке он теряется среди соседей. */
let halo = null;

function highlightMarker(id) {
  const m = markers.get(id);
  if (halo) { layer.removeLayer(halo); halo = null; }
  if (!m) return;                            // маркера нет: квартира отфильтрована

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent").trim() || "#2a78d6";
  const ll = m.getLatLng();
  halo = L.circleMarker(ll, {
    renderer: canvas, pane: "pApts",
    radius: 15, weight: 2, color: accent,
    fillColor: accent, fillOpacity: .18, interactive: false,
  }).addTo(layer);
  halo.bringToBack();                        // под маркерами, а не поверх них
  m.bringToFront();
}

/* Минуты до личного адреса. В layers.json это {токен: {id: минуты}} — токен
 * один (адрес в config), но структура от старой карты, где их было несколько. */
function commute(id) {
  const tt = state.layers?.tt;
  if (!tt) return null;
  for (const tok in tt) if (tt[tok][id] != null) return tt[tok][id];
  return null;
}

/* ── Сравнение двух квартир ──────────────────────────────────────────────────
 * Только две: при двух колонках таблица влезает в шторку и отдельный экран не
 * нужен. Расстояния до GIS-слоёв сюда НЕ идут — там 34 строки, они утопят
 * то, ради чего сравнение затевалось.
 *
 * Ход: в карточке жмём «Сравнить» — квартира откладывается. Открываем вторую,
 * там уже «Сравнить с уже выбранной».
 *
 * Направление «лучше» задано ЯВНО и только там, где оно объективно. У этажа,
 * года, района, продавца его нет: пометка «лучше» на строке «этаж» — это
 * таблица, которая уверенно врёт. Площадь тоже без направления — больше метров
 * за большую цену не лучше; направление даёт цена за м², она в списке есть. */
const CMP_ROWS = [
  ["f_price",    (a) => a.p,            "min", (v) => money(v)],
  ["f_ppm",      (a) => a.ppm,          "min", (v) => `${nf.format(Math.round(v))} ${tr("ppm_u")}`],
  ["f_own",      (a) => monthly(a.p, a.cz), "min", (v) => `~${nf.format(Math.round(v))} ${tr("mo")}`],
  ["fair",       (a) => a.fp,           "min", (v) => `${v > 0 ? "+" : ""}${Math.round(v)}%`],
  ["rating",     (a) => a.sc,           "max", (v) => Math.round(v)],
  ["f_area2",    (a) => a.a,            null,  (v) => num(v, " " + tr("m2"))],
  ["f_rooms2",   (a) => a.r,            null,  (v) => v],
  ["f_floor",    (a) => a.fl,           null,  (v) => v],
  ["f_year2",    (a) => a.by,           null,  (v) => v],
  ["f_district", (a) => a.d,            null,  (v) => v],
  ["f_seller2",  (a) => LABEL.ut[a.ut], null,  (v) => v],
  ["f_market2",  (a) => LABEL.mt[a.mt], null,  (v) => v],
  ["f_cond2",    (a) => LABEL.cs[a.cs], null,  (v) => v],
  ["f_commute2", (a) => commute(a.id),  "min", (v) => `${v} ${tr("min")}`],
  ["f_metro",    (a) => a.wm,           "min", (v) => `${v} ${tr("min")}`],
  ["f_noise",    (a) => a.nl,           "min", (v) => `${v} ${tr("db")}`],
  ["f_school",   (a) => a.se,           "max", (v) => `${Math.round(v)}%`],
  ["f_since",    (a) => a.seen,         null,  (v) => v],
];

function cmpHtml(a, b) {
  const axes = (state.meta.axes || []).map((_, i) =>
    [axisName(i), a.ax?.[i], b.ax?.[i], "max", (v) => v]);

  const rows = [
    ...CMP_ROWS.map(([key, get, dir, fmt]) => [tr(key), get(a), get(b), dir, fmt]),
    ...axes,
  ];

  const body = rows.map(([name, va, vb, dir, fmt]) => {
    if (va == null && vb == null) return "";
    const same = va === vb;
    // Кто лучше — только для строк с заданным направлением и разными числами
    let best = 0;
    if (dir && !same && typeof va === "number" && typeof vb === "number") {
      best = dir === "min" ? (va < vb ? 1 : 2) : (va > vb ? 1 : 2);
    }
    const cell = (v, side) =>
      `<td class="${best === side ? "cmp-best" : ""}">${
        v == null ? "—" : esc(String(fmt(v)))}${best === side ? " ★" : ""}</td>`;
    // Одинаковое гасим: сравнение — про то, чем квартиры отличаются
    return `<tr class="${same ? "cmp-same" : ""}">
      <th>${esc(name)}</th>${cell(va, 1)}${cell(vb, 2)}</tr>`;
  }).join("");

  const head = (x) => esc([x.d, x.st].filter(Boolean).join(", ") || tr("noaddr"));
  return `<h2>${esc(tr("cmp_title"))}</h2>
    <table class="cmp">
      <tr><th></th><th>${head(a)}</th><th>${head(b)}</th></tr>
      ${body}
    </table>
    <div class="sheet-links">
      <a href="${esc(a.u)}" target="_blank" rel="noopener">${tr("otodom")} 1</a>
      <a href="${esc(b.u)}" target="_blank" rel="noopener">${tr("otodom")} 2</a>
      <button class="ghost" id="cmp-close">${tr("cmp_back")}</button>
    </div>`;
}

/* Выбор из списка: первый клик откладывает, второй по другой карточке —
 * открывает сравнение, повторный по той же — отменяет. */
function pickCompare(id) {
  if (state.cmpId === id) { state.cmpId = null; return renderList(); }
  if (state.cmpId) {
    const a = state.all.find((x) => x.id === state.cmpId);
    const b = state.all.find((x) => x.id === id);
    if (a && b) { state.cmpId = null; renderList(); return openCompare(a, b); }
  }
  state.cmpId = id;
  renderList();
}

/* Кнопка сравнения. Пусто — «Сравнить» (отложить). Уже отложена другая —
 * «Сравнить с уже выбранной». Отложена ЭТА же — «Отменить сравнение». */
function bindCompare(a) {
  const btn = $("#cmp-btn");
  if (!btn) return;
  const other = state.cmpId && state.cmpId !== a.id
    ? state.all.find((x) => x.id === state.cmpId) : null;

  btn.textContent = other ? tr("cmp_with")
    : state.cmpId === a.id ? tr("cmp_drop") : tr("cmp_pick");

  btn.onclick = () => {
    if (other) return openCompare(other, a);
    state.cmpId = state.cmpId === a.id ? null : a.id;
    bindCompare(a);
    renderList();          // отметка в списке должна совпадать со шторкой
  };
}

function openCompare(a, b) {
  $("#sheet-body").innerHTML = cmpHtml(a, b);
  $("#sheet").hidden = false;
  $("#cmp-close").onclick = () => { state.cmpId = null; openSheet(a); };
}

/* ── Расстояния до GIS-объектов ──────────────────────────────────────────────
 * Из чего сложился рейтинг: ~44 слоя с метрами до ближайшего объекта.
 * Файл общий со старой картой — data/dist.json это симлинк на 3.map/dist.json,
 * его кладёт export.py. Весит 3.3 МБ, поэтому грузим лениво, при первом
 * открытии карточки, а не вместе со страницей.
 * Формат записи: [индекс_слоя, метры, название, "lat,lon", минут_пешком];
 * подпись/знак/вес лежат отдельно в dist.layers, чтобы не дублироваться
 * в каждой из ~170 тысяч записей. */
let BUILD = "";     // версия сборки данных (meta.generated) — гасит кеш точечно
let distData = null, remData = null, heavyLoading = null;
let photoData = null, photoLoading = null;
let galleryKeys = null;

/* Фото грузим ОТДЕЛЬНО от расстояний: файл 4.2 МБ, и если тянуть его одним
 * пакетом, то блок «Что рядом» ждал бы картинки, хотя нужен раньше. */
function loadPhotos() {
  photoLoading ||= fetch(`data/photos.json?v=${BUILD}`)
    .then((r) => r.json())
    .then((d) => (photoData = d))
    .catch(() => (photoData = {}));
  return photoLoading;
}

/* Галерея: крупный кадр + лента миниатюр. Переключение — на самой странице,
 * без модалок: карточка и так узкая, лишний слой поверх мешал бы. */
function galleryHtml(a) {
  const urls = photoData?.[a.id];
  if (!urls?.length) return a.img ? `<img class="ph-main" src="${esc(a.img)}" alt="" loading="lazy">` : "";
  const many = urls.length > 1;
  const thumbs = !many ? "" : `<div class="ph-strip">${
    urls.map((u, i) => `<img src="${esc(u)}" alt="" loading="lazy" data-i="${i}"
                        class="ph-th${i ? "" : " on"}">`).join("")}</div>`;
  // Стрелки только когда есть куда листать; кадры зациклены — с последнего на первый
  const arrows = !many ? "" :
    `<button class="ph-nav prev" data-d="-1" aria-label="←">‹</button>
     <button class="ph-nav next" data-d="1" aria-label="→">›</button>`;
  return `<div class="ph">
    <img class="ph-main" src="${esc(urls[0])}" alt="" loading="lazy">
    ${arrows}
    ${many ? `<div class="ph-n"><span>1</span> / ${urls.length}</div>` : ""}
    ${thumbs}
  </div>`;
}

/* Клик по миниатюре меняет крупный кадр. Вешаем один обработчик на контейнер:
 * карточка перерисовывается целиком, и переподписываться на каждую картинку
 * пришлось бы каждый раз. */
function bindGallery() {
  const box = $("#sheet-body").querySelector(".ph");
  if (!box) return;
  const thumbs = [...box.querySelectorAll(".ph-th")];
  if (!thumbs.length) return;
  let cur = 0;

  const show = (i) => {
    cur = (i + thumbs.length) % thumbs.length;   // зацикливаем в обе стороны
    box.querySelector(".ph-main").src = thumbs[cur].src;
    thumbs.forEach((t, k) => t.classList.toggle("on", k === cur));
    const n = box.querySelector(".ph-n span");
    if (n) n.textContent = String(cur + 1);
    // держим активную миниатюру в поле зрения ленты
    thumbs[cur].scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  box.onclick = (e) => {
    const nav = e.target.closest?.(".ph-nav");
    if (nav) return show(cur + +nav.dataset.d);
    const th = e.target.closest?.(".ph-th");
    if (th) show(thumbs.indexOf(th));
  };

  // Стрелки клавиатуры работают, пока открыта карточка
  galleryKeys = (e) => {
    if ($("#sheet").hidden) return;
    if (e.key === "ArrowLeft") show(cur - 1);
    else if (e.key === "ArrowRight") show(cur + 1);
  };
}


/* Тяжёлые файлы (dist.json 3.3 МБ + removed.json 1 МБ) нужны только внутри
 * карточки, поэтому тянем их при первом её открытии, а не при загрузке
 * страницы. Одно обещание на всех: два быстрых клика не дадут двух загрузок. */
function loadHeavy() {
  heavyLoading ||= Promise.all([
    fetch(`data/dist.json?v=${BUILD}`).then((r) => r.json()).catch(() => ({ layers: [], apts: {} })),
    fetch(`data/removed.json?v=${BUILD}`).then((r) => r.json()).catch(() => ({})),
  ]).then(([d, r]) => { distData = d; remData = r; });
  return heavyLoading;
}

// Ключ точки — те же 5 знаков, что в export.py: активные и снятые
// объявления по одному адресу должны попадать в одну корзину
const locKey = (lat, lon) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

/* Снятые с продажи по этому же адресу. Единственный источник истории цен
 * по дому: сколько просили за соседние квартиры и когда объявление ушло. */
function removedHtml(a) {
  if (a.lat == null) return "";
  const rows = remData?.[locKey(a.lat, a.lon)];
  if (!rows?.length) return "";
  const items = rows.map((r) => `
    <div class="rrow">
      <span class="roff">${tr("roff")} ${r.off ?? "—"}</span>
      <div>${money(r.p)}${r.ppm ? ` · ${nf.format(Math.round(r.ppm))} ${tr("ppm_u")}` : ""}</div>
      <div>${num(r.a, " " + tr("m2"))} · ${r.r ?? "?"} ${tr("rooms_s")}${r.sc != null ? ` · ${tr("rating")} ${Math.round(r.sc)}` : ""}</div>
      <a href="${esc(r.u)}" target="_blank" rel="noopener">${tr("arch")}</a>
    </div>`).join("");
  return `<details class="rem"><summary>${tr("rem")} (${rows.length})</summary>${items}</details>`;
}

const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + " " + tr("km") : Math.round(m) + " " + tr("m_u"));

function distRow(d, layers) {
  // подпись слоя переводим через meta.i18n (PLDIST из старой карты)
  const label = distName((layers[d[0]] || ["?"])[0]);
  const walk = d[4] != null ? ` <span class="dw">· ${d[4]} ${tr("min")}</span>` : "";
  // Название кликабельно: ведёт в Google Maps по координатам объекта
  const name = d[2]
    ? (d[3] ? `<a href="https://www.google.com/maps?q=${d[3]}" target="_blank" rel="noopener">${esc(d[2])}</a>`
            : esc(d[2]))
    : "";
  return `<div class="drow"><span>${esc(label)}${name ? `<br>${name}` : ""}</span>
          <b>${fmtM(d[1])}${walk}</b></div>`;
}

function distHtml(id) {
  if (!distData) return `<div class="gap-note">${tr("dwait")}</div>`;
  const { layers, apts } = distData;
  const rows = apts?.[id];
  if (!rows?.length) return "";

  // Знак слоя (плюс/минус) лежит в мете, а не в записи
  const pos = rows.filter((d) => (layers[d[0]] || [0, true])[1]);
  const neg = rows.filter((d) => !(layers[d[0]] || [0, true])[1]);

  // Порядок как в старой карте: сначала весомые слои, внутри — ближние
  const sorted = (arr) => [...arr].sort((x, y) =>
    (layers[y[0]]?.[2] ?? 1) - (layers[x[0]]?.[2] ?? 1) || x[1] - y[1]);

  const sec = (arr, title, cls) => arr.length
    ? `<details class="dsec ${cls}"><summary>${title} (${arr.length})</summary>
       ${sorted(arr).map((d) => distRow(d, layers)).join("")}</details>` : "";

  return `<details class="dist"><summary>${tr("dist")}</summary>
    ${sec(pos, tr("pos"), "pos")}${sec(neg, tr("neg"), "neg")}</details>`;
}

function openSheet(a) {
  const own = monthly(a.p, a.cz);
  const rows = [
    [tr("f_ppm"), a.ppm ? `${nf.format(Math.round(a.ppm))} zł` : "—"],
    [tr("f_area2"), num(a.a, " " + tr("m2"))],
    [tr("f_rooms2"), a.r ?? "—"],
    [tr("f_floor"), a.fl != null ? `${a.fl}${a.tf ? ` ${tr("f_of")} ${a.tf}` : ""}` : "—"],
    [tr("f_year2"), a.by ?? "—"],
    [tr("f_seller2"), LABEL.ut[a.ut] ?? "—"],
    [tr("f_market2"), LABEL.mt[a.mt] ?? "—"],
    [tr("f_cond2"), LABEL.cs[a.cs] ?? "—"],
    [tr("f_metro"), a.wm != null ? `${a.wm} ${tr("min")}${a.mn ? ` (${a.mn})` : ""}` : "—"],
    [tr("f_noise"), a.nl == null ? "—" : a.nl < 55 ? tr("noise_lt") : `${a.nl} ${tr("db")}`],
    [tr("f_school"), a.se != null ? `${Math.round(a.se)}%` : "—"],
    [tr("f_own"), own ? `~${nf.format(Math.round(own))} ${tr("mo")}` : "—"],
    [tr("f_since"), a.seen ?? "—"],
  ];
  // «Дорога до дома» — только в личной сборке: в публичной изохрон нет
  const cm = commute(a.id);
  if (cm != null) rows.push([tr("f_commute2"), `${cm} ${tr("min")}`]);

  $("#sheet-body").innerHTML = `
    <h2>${esc([a.d, a.st].filter(Boolean).join(", ") || tr("noaddr"))}</h2>
    <div class="price-row">
      <span class="price">${money(a.p)}</span>
      <button class="cmp-btn" id="cmp-btn"></button>
    </div>
    <div class="card-sub">${tr("rating")} ${Math.round(a.sc)}/100 ${fairHtml(a)}</div>
    ${a.blur >= 100 ? `<div class="gap-note">${tr("blur")(a.blur)}</div>` : ""}
    ${axesHtml(a)}
    ${a.gap ? `<div class="gap-note">${tr("gaps")(a.gap)}</div>` : ""}
    <div id="ph-slot">${galleryHtml(a)}</div>
    <dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <div id="dist-slot">${distHtml(a.id)}${removedHtml(a)}</div>
    <div class="sheet-links">
      <a href="${esc(a.u)}" target="_blank" rel="noopener">${tr("otodom")}</a>
      <a href="https://www.google.com/maps?layer=c&cbll=${a.lat},${a.lon}" target="_blank" rel="noopener">${tr("street")}</a>
      ${a.dev ? `<a href="${esc(a.dev)}" target="_blank" rel="noopener">${tr("devall")}</a>` : ""}
    </div>`;
  $("#sheet").hidden = false;
  bindCompare(a);
  bindGallery();
  // Фото при первом открытии карточки; пришли — дорисовываем, если карточка та же
  if (!photoData) {
    loadPhotos().then(() => {
      if (state.activeId === a.id) {
        $("#ph-slot").innerHTML = galleryHtml(a);
        bindGallery();
      }
    });
  }

  // Первый показ карточки тянет dist.json; когда пришёл — дорисовываем блок,
  // но только если пользователь всё ещё смотрит ту же квартиру
  if (!distData) {
    loadHeavy().then(() => {
      if (state.activeId === a.id)
        $("#dist-slot").innerHTML = distHtml(a.id) + removedHtml(a);
    });
  }
}

// Тема из прошлого визита — до первой отрисовки, чтобы не мигало
try {
  const t = localStorage.getItem("wf_theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch {}

/* ── Свежесть данных ─────────────────────────────────────────────────────────
 * Вкладка живёт открытой сутками, а пайплайн пересобирает данные 4-5 раз в
 * день. Раз в 5 минут спрашиваем meta.json (4 КБ) и сравниваем поле generated.
 *
 * Страницу НЕ перезагружаем сами: человек мог отфильтровать выдачу и изучать
 * конкретную квартиру — выдёргивать её из-под него грубо. Показываем плашку,
 * решает он.
 *
 * Анти-кеш в запросе обязателен: GitHub Pages держит ассеты 10 минут, без
 * него опрос возвращал бы ту же копию и обновление заметилось бы с опозданием. */
const FRESH_EVERY_MS = 5 * 60 * 1000;

function watchFreshness() {
  const mine = state.meta?.generated;
  if (!mine) return;
  setInterval(async () => {
    try {
      const r = await fetch(`data/meta.json?_=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return;
      const m = await r.json();
      if (m.generated && m.generated !== mine) showFresh();
    } catch { /* сеть моргнула — молча ждём следующей попытки */ }
  }, FRESH_EVERY_MS);
}

function showFresh() {
  if ($("#fresh")) return;              // плашка уже висит — не плодим
  const box = document.createElement("div");
  box.id = "fresh";
  box.className = "fresh";
  box.innerHTML = `<span>${tr("fresh")}</span>
                   <button class="ghost">${tr("fresh_btn")}</button>`;
  box.querySelector("button").onclick = () => {
    // Просто reload() отдал бы страницу и скрипты из кеша — те самые 10 минут.
    // Меняем параметр v, и браузер вынужден сходить на сервер.
    const q = new URLSearchParams(location.search);
    q.set("v", String(Date.now()));
    location.replace(`${location.pathname}?${q}`);
  };
  document.body.appendChild(box);
}

/* Высота шапки и полосы фильтров — в CSS-переменную, от неё считается верх
 * шторки. Хардкодить нельзя: полоса фильтров переносится на второй ряд при
 * узком окне и на польском (подписи длиннее), и карточка накрыла бы её. */
/* ── Ширина списка ───────────────────────────────────────────────────────────
 * Тянем разделитель — меняется колонка списка. По умолчанию 380 px, а не
 * половина экрана: на широком мониторе список съедал половину площади.
 * Значение живёт в localStorage, пределы — 280 px и 60% ширины окна, иначе
 * список можно утащить в ноль или закрыть им карту целиком. */
const LIST_MIN = 280;
const listMax = () => Math.max(LIST_MIN, window.innerWidth * 0.6);

function setListWidth(px, save = true) {
  const w = Math.round(Math.min(listMax(), Math.max(LIST_MIN, px)));
  document.documentElement.style.setProperty("--list-w", `${w}px`);
  if (save) { try { localStorage.setItem("wf_listw", String(w)); } catch {} }
  map?.invalidateSize();
}

function initGutter() {
  const g = $("#gutter");
  if (!g) return;
  try {
    const saved = +localStorage.getItem("wf_listw");
    if (saved) setListWidth(saved, false);
  } catch {}

  const move = (e) => setListWidth(e.clientX ?? e.touches?.[0]?.clientX ?? 0, false);
  const stop = () => {
    document.body.classList.remove("dragging");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    // сохраняем один раз в конце, а не на каждый пиксель движения
    const cur = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue("--list-w"), 10);
    if (cur) setListWidth(cur);
  };
  g.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    document.body.classList.add("dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  });
  // Клавиатура: разделитель — тоже управляющий элемент
  g.addEventListener("keydown", (e) => {
    const cur = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue("--list-w"), 10) || LIST_MIN;
    if (e.key === "ArrowLeft") setListWidth(cur - 32);
    else if (e.key === "ArrowRight") setListWidth(cur + 32);
  });
}

function measureChrome() {
  const top = document.querySelector(".top");
  const flt = document.querySelector(".filters");
  if (!top || !flt) return;
  const h = top.getBoundingClientRect().height + flt.getBoundingClientRect().height;
  // Разумные пределы: одна строка фильтров ~80 px, три ряда ~200. Значение вне
  // диапазона означает, что померили не то (скрытый элемент, не догрузился
  // шрифт) — тогда лучше оставить запасное из CSS, чем увести шторку за экран.
  if (h >= 40 && h <= 320) {
    document.documentElement.style.setProperty("--chrome-h", `${Math.round(h)}px`);
  }
  // отдельно высота ТОЛЬКО шапки: от неё начинается панель фильтров на телефоне
  const th = top.getBoundingClientRect().height;
  if (th >= 30 && th <= 120) {
    document.documentElement.style.setProperty("--head-h", `${Math.round(th)}px`);
  }
}

window.addEventListener("resize", measureChrome);

document.addEventListener("keydown", (e) => galleryKeys?.(e));

load().catch((e) => {
  $("#list").innerHTML = `<p class="empty">${tr("err")}<br>${esc(e.message)}<br><br>
    ${tr("err_h")}</p>`;
});
