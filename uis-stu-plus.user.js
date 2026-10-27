// ==UserScript==
// @name         UIS STU+
// @namespace    https://is.stuba.sk/
// @homepageURL  https://github.com/Manerger/uis-stu-plus
// @downloadURL  https://raw.githubusercontent.com/Manerger/uis-stu-plus/main/uis-stu-plus.user.js
// @updateURL    https://raw.githubusercontent.com/Manerger/uis-stu-plus/main/uis-stu-plus.user.js
// @version      2.5.0
// @description  A cleaner, more informative UIS STU (is.stuba.sk): slim header, today's classes and semester week, quick search (Ctrl+K), pinned pages, better tables and timetable, dark mode.
// @match        https://is.stuba.sk/*
// @run-at       document-start
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '2.5.0';
  // At document-start the <html> element may not exist yet; it is assigned in applyEarly() below.
  let ROOT = document.documentElement;
  // Header bar state. Declared up front because applyEarly() -> applyTheme() -> refreshBar() can run
  // while this script is still being evaluated (Firefox managers start it after <html> exists).
  let bar = null;
  let subBar = null;
  let header = null;
  let menu = null;
  let ttSection = null;
  let weekOffset = 0;

  /* ------------------------------------------------------------------ *
   * Storage: userscript storage when available, localStorage otherwise *
   * ------------------------------------------------------------------ */
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  const store = {
    get(key, fallback) {
      try {
        if (hasGM) return GM_getValue(key, fallback);
        const raw = localStorage.getItem('aisx:' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (hasGM) GM_setValue(key, value);
        else localStorage.setItem('aisx:' + key, JSON.stringify(value));
      } catch (e) {
        /* storage full or blocked: features keep working for this page */
      }
    },
  };

  const DEFAULTS = {
    enabled: true,
    theme: 'auto', // auto | light | dark
    density: 'comfortable', // comfortable | compact
    fontSize: 14,
    topBar: true,
    today: true,
    notices: true,
    tableTools: true,
    grades: true,
    lang: 'auto', // auto | sk | en
  };
  const settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  /* ------------------------------------------------------------------ *
   * Text                                                                *
   * ------------------------------------------------------------------ */
  const STR = {
    en: {
      home: 'UIS home',
      search: 'Search UIS…',
      searchPh: 'Search pages, courses and links…',
      noResults: 'Nothing found. UIS+ learns links from every UIS page you open, so results grow as you browse.',
      kindFav: 'Pinned', kindRecent: 'Recent', kindLink: 'Link', kindCmd: 'Action',
      pin: 'Pin this page', unpin: 'Unpin this page', pinned: 'Page pinned', unpinned: 'Page unpinned',
      themeToggle: 'Toggle dark mode', settings: 'UIS+ settings', logout: 'Log out',
      mail: 'Messages', docs: 'New documents', tasks: 'Tasks',
      filter: 'Filter rows…',
      rows: (shown, total) => (shown === total ? `${total} rows` : `${shown} of ${total} rows`),
      copy: 'Copy', copyTitle: 'Copy the visible rows (paste into Excel or Sheets)', csv: 'CSV', csvTitle: 'Download the visible rows as a CSV file',
      copied: 'Copied. Paste it into Excel or Google Sheets.', sortTitle: 'Click to sort',
      gradesTitle: 'Grade summary', avg: 'Weighted average', credits: 'Credits earned', graded: 'Graded courses',
      ofCredits: n => `of ${n} with a grade`, pendingN: n => `${n} not graded yet`,
      gradesNote: 'Unofficial. Calculated by UIS+ from this table: A = 1, B = 1.5, C = 2, D = 2.5, E = 3, FX = 4, weighted by credits.',
      week: (n, odd) => `Week ${n} · ${odd ? 'odd' : 'even'}`,
      weekLong: (n, odd) => `Week ${n} of the semester, ${odd ? 'odd' : 'even'} week`,
      startsIn: d => (d === 1 ? 'Semester starts tomorrow' : `Semester starts in ${d} days`),
      exams: 'Exam period',
      now: 'Now', next: 'Next', until: t => `until ${t}`, tomorrow: 'Tomorrow',
      noClassesToday: 'No more classes today', noClassesWeek: 'No classes in the next 7 days',
      lecture: 'Lecture', seminar: 'Seminar', other: 'Class',
      nameday: n => `Name day: ${n}`, fullTimetable: 'Full timetable',
      notThisWeek: w => `Not this week (${w} week)`, dayOff: 'Day off',
      ttLegend: (n, odd) => `Week ${n} (${odd ? 'odd' : 'even'}): faded classes do not take place this week.`,
      outsideTeaching: 'No teaching', beforeSemester: 'Before the semester',
      prevWeek: 'Previous week', nextWeek: 'Next week', thisWeek: 'This week',
      edit: 'Edit', collapse: 'Collapse timetable', expand: 'Show timetable',
      ttLoading: 'Loading your timetable from UIS…', ttFailed: 'The timetable could not be loaded from UIS.', retry: 'Try again',
      noTeachingWeek: 'No classes this week.',
      notices: 'Notices and noticeboard', noticeRed: 'Important', noticeBlue: 'Information', noticeYellow: 'Noticeboard', show: 'Show', hide: 'Hide',
      edTitle: 'Edit timetable', edSource: 'Timetable source', edPersonal: 'My personal timetable from UIS', edOther: 'Another UIS timetable (choose criteria)',
      edCurrent: s => `In use: ${s}`, edPersonalName: 'Personal timetable',
      edCriteriaHelp: 'Choose criteria just like on the UIS Timetables page, for example study programme, year and group, or a course.',
      edUse: 'Use this timetable', edLoading: 'Loading…', edNoCriteria: 'Choose at least one criterion.', edNoLessons: 'No classes were found for these criteria.',
      edCriteriaFailed: 'The UIS timetable criteria could not be loaded.', edSourceSaved: s => `Now showing: ${s}`,
      edClasses: 'Classes', edClassesHelp: 'Untick a class to hide it (for example a parallel group you do not attend). Use the pencil to change it.',
      edAdd: 'Add class', edName: 'Name', edKind: 'Type', edDay: 'Day', edFrom: 'From', edTo: 'To', edRoom: 'Room', edTeacher: 'Teacher', edWeeks: 'Weeks',
      every: 'every week', odd: 'odd weeks', even: 'even weeks', save: 'Save', cancel: 'Cancel', revert: 'Original', del: 'Delete',
      custom: 'added', edited: 'edited', edResetAll: 'Undo all changes', edResetConfirm: 'Undo all hidden, edited and added classes?',
      edInvalid: 'Fill in the name and a start time before the end time.', edEmpty: 'No classes yet. Add one or choose a timetable above.',
      useInAis: 'Use in UIS+', usedInAis: 'Shown in UIS+', useSaved: 'This timetable is now shown in UIS+',
      today: 'Today', account: 'Account', loggedInAs: 'Logged in', help: 'Help', location: 'Location', darkMode: 'Dark mode', more: 'More',
      modeWeek: 'Week', modeDay: 'Day', modeMini: 'Mini', ttView: 'Timetable view',
      ttHideHere: 'Hide the timetable in this part of UIS', ttShowHere: 'Show the timetable in this part of UIS',
      ttHiddenHere: 'Timetable hidden in this part of UIS. Bring it back with the calendar icon at the top.',
      helpOnlyCzech: 'UIS help is only available in Czech.', opsTitle: 'UIS statistics',
      hideSec: 'Hide this section', hiddenSecs: 'Hidden sections:', restoreAll: 'Show all',
      restoreSec: n => `Show “${n}” again`, secHidden: n => `“${n}” hidden. Bring it back below the sections.`,
      cmdDark: 'Toggle dark mode', cmdSettings: 'Open UIS+ settings', cmdOff: 'Turn UIS+ off (original look)', cmdTimetable: 'Open my timetable', cmdEditTt: 'Edit timetable in UIS+',
      offPill: 'UIS+ is off — click to turn on',
      sAppearance: 'Appearance', sEnabled: 'UIS+ enabled', sTheme: 'Theme', themeAuto: 'Match my system', themeLight: 'Light', themeDark: 'Dark',
      sDensity: 'Table density', densComfortable: 'Comfortable', densCompact: 'Compact', sFont: 'Text size',
      sFeatures: 'Features', sTopBar: 'Slim header bar (replaces the big STU header)', sToday: 'Timetable section under the header (week, current time)',
      sNotices: 'Combine notices and noticeboard into one drop-down',
      sTableTools: 'Table tools (filter, sort, copy, CSV)', sGrades: 'Colour grades and show a grade summary',
      sLang: 'Language', langAuto: 'Same as UIS',
      sData: 'Semester data', dataStatus: (w, t) => `Weeks: ${w ? 'loaded' : 'not loaded'} · Timetable: ${t ? 'loaded' : 'not loaded'}`,
      refreshNow: 'Refresh now', refreshing: 'Refreshing…', refreshDone: 'Timetable and weeks refreshed', refreshFail: 'Could not load the timetable from UIS',
      dataHelp: 'UIS+ reads your timetable and the academic weeks overview from UIS (twice a day at most) and keeps them, and your timetable changes, only in this browser.',
      sPins: 'Pinned pages', sPinsEmpty: 'No pinned pages yet. Use the star in the header.', remove: 'Remove',
      sHelp: 'Help', dump: 'Copy page structure', dumpHelp: 'Copies the layout of this page (tags and class names, no grades or personal text) so the script can be improved for it.',
      dumped: 'Page structure copied to the clipboard', reset: 'Reset UIS+', resetConfirm: 'Clear all UIS+ settings, pinned pages and saved data?',
      close: 'Close', shortcuts: 'Shortcuts: Ctrl+K search · / filter the table · Esc close',
    },
    sk: {
      home: 'Úvodná stránka UIS',
      search: 'Hľadať v UIS…',
      searchPh: 'Hľadať stránky, predmety a odkazy…',
      noResults: 'Nič sa nenašlo. UIS+ sa učí odkazy z každej stránky UIS, ktorú otvoríte, takže výsledkov časom pribudne.',
      kindFav: 'Pripnuté', kindRecent: 'Nedávne', kindLink: 'Odkaz', kindCmd: 'Akcia',
      pin: 'Pripnúť túto stránku', unpin: 'Odopnúť túto stránku', pinned: 'Stránka pripnutá', unpinned: 'Stránka odopnutá',
      themeToggle: 'Prepnúť tmavý režim', settings: 'Nastavenia UIS+', logout: 'Odhlásiť sa',
      mail: 'Správy', docs: 'Nové dokumenty', tasks: 'Úlohy',
      filter: 'Filtrovať riadky…',
      rows: (shown, total) => (shown === total ? `${total} riadkov` : `${shown} z ${total} riadkov`),
      copy: 'Kopírovať', copyTitle: 'Skopírovať viditeľné riadky (vložte do Excelu alebo Tabuliek)', csv: 'CSV', csvTitle: 'Stiahnuť viditeľné riadky ako CSV',
      copied: 'Skopírované. Vložte do Excelu alebo Google Tabuliek.', sortTitle: 'Kliknutím zoradíte',
      gradesTitle: 'Súhrn hodnotení', avg: 'Vážený priemer', credits: 'Získané kredity', graded: 'Hodnotené predmety',
      ofCredits: n => `z ${n} hodnotených`, pendingN: n => `${n} zatiaľ bez hodnotenia`,
      gradesNote: 'Neoficiálne. UIS+ to počíta z tejto tabuľky: A = 1, B = 1,5, C = 2, D = 2,5, E = 3, FX = 4, vážené kreditmi.',
      week: (n, odd) => `${n}. týždeň · ${odd ? 'nepárny' : 'párny'}`,
      weekLong: (n, odd) => `${n}. týždeň semestra, ${odd ? 'nepárny' : 'párny'} týždeň`,
      startsIn: d => (d === 1 ? 'Semester začína zajtra' : `Semester začína o ${d} dní`),
      exams: 'Skúškové obdobie',
      now: 'Teraz', next: 'Ďalej', until: t => `do ${t}`, tomorrow: 'Zajtra',
      noClassesToday: 'Dnes už nemáte výučbu', noClassesWeek: 'V najbližších 7 dňoch nemáte výučbu',
      lecture: 'Prednáška', seminar: 'Cvičenie', other: 'Výučba',
      nameday: n => `Meniny: ${n}`, fullTimetable: 'Celý rozvrh',
      notThisWeek: w => `Tento týždeň nie (${w} týždeň)`, dayOff: 'Voľný deň',
      ttLegend: (n, odd) => `${n}. týždeň (${odd ? 'nepárny' : 'párny'}): vyblednuté hodiny tento týždeň nie sú.`,
      outsideTeaching: 'Bez výučby', beforeSemester: 'Pred semestrom',
      prevWeek: 'Predchádzajúci týždeň', nextWeek: 'Nasledujúci týždeň', thisWeek: 'Tento týždeň',
      edit: 'Upraviť', collapse: 'Zbaliť rozvrh', expand: 'Zobraziť rozvrh',
      ttLoading: 'Načítavam váš rozvrh z UIS…', ttFailed: 'Rozvrh sa z UIS nepodarilo načítať.', retry: 'Skúsiť znova',
      noTeachingWeek: 'Tento týždeň nemáte výučbu.',
      notices: 'Oznamy a výveska', noticeRed: 'Dôležité', noticeBlue: 'Informácie', noticeYellow: 'Výveska', show: 'Zobraziť', hide: 'Skryť',
      edTitle: 'Upraviť rozvrh', edSource: 'Zdroj rozvrhu', edPersonal: 'Môj osobný rozvrh z UIS', edOther: 'Iný rozvrh z UIS (podľa kritérií)',
      edCurrent: s => `Používa sa: ${s}`, edPersonalName: 'Osobný rozvrh',
      edCriteriaHelp: 'Vyberte kritériá rovnako ako na stránke Rozvrhy v UIS, napríklad program, ročník a skupinu alebo predmet.',
      edUse: 'Použiť tento rozvrh', edLoading: 'Načítavam…', edNoCriteria: 'Vyberte aspoň jedno kritérium.', edNoLessons: 'Pre tieto kritériá sa nenašli žiadne hodiny.',
      edCriteriaFailed: 'Kritériá rozvrhov sa z UIS nepodarilo načítať.', edSourceSaved: s => `Zobrazuje sa: ${s}`,
      edClasses: 'Hodiny', edClassesHelp: 'Odškrtnutím hodinu skryjete (napríklad paralelnú skupinu, do ktorej nechodíte). Ceruzkou ju upravíte.',
      edAdd: 'Pridať hodinu', edName: 'Názov', edKind: 'Typ', edDay: 'Deň', edFrom: 'Od', edTo: 'Do', edRoom: 'Miestnosť', edTeacher: 'Vyučujúci', edWeeks: 'Týždne',
      every: 'každý týždeň', odd: 'nepárne týždne', even: 'párne týždne', save: 'Uložiť', cancel: 'Zrušiť', revert: 'Pôvodné', del: 'Odstrániť',
      custom: 'pridaná', edited: 'upravená', edResetAll: 'Zrušiť všetky úpravy', edResetConfirm: 'Zrušiť všetky skryté, upravené a pridané hodiny?',
      edInvalid: 'Vyplňte názov a začiatok pred koncom.', edEmpty: 'Zatiaľ žiadne hodiny. Pridajte hodinu alebo vyberte rozvrh vyššie.',
      useInAis: 'Použiť v UIS+', usedInAis: 'Zobrazuje sa v UIS+', useSaved: 'Tento rozvrh sa teraz zobrazuje v UIS+',
      today: 'Dnes', account: 'Účet', loggedInAs: 'Prihlásený', help: 'Pomocník', location: 'Umiestnenie', darkMode: 'Tmavý režim', more: 'Ďalšie',
      modeWeek: 'Týždeň', modeDay: 'Deň', modeMini: 'Mini', ttView: 'Zobrazenie rozvrhu',
      ttHideHere: 'Skryť rozvrh v tejto časti UIS', ttShowHere: 'Zobraziť rozvrh v tejto časti UIS',
      ttHiddenHere: 'Rozvrh je v tejto časti UIS skrytý. Vrátite ho ikonou kalendára hore.',
      helpOnlyCzech: 'Pomocník UIS je dostupný len v češtine.', opsTitle: 'Štatistiky UIS',
      hideSec: 'Skryť túto sekciu', hiddenSecs: 'Skryté sekcie:', restoreAll: 'Zobraziť všetky',
      restoreSec: n => `Znova zobraziť „${n}“`, secHidden: n => `Sekcia „${n}“ je skrytá. Vrátite ju pod zoznamom sekcií.`,
      cmdDark: 'Prepnúť tmavý režim', cmdSettings: 'Otvoriť nastavenia UIS+', cmdOff: 'Vypnúť UIS+ (pôvodný vzhľad)', cmdTimetable: 'Otvoriť môj rozvrh', cmdEditTt: 'Upraviť rozvrh v UIS+',
      offPill: 'UIS+ je vypnuté — kliknutím zapnete',
      sAppearance: 'Vzhľad', sEnabled: 'UIS+ zapnuté', sTheme: 'Téma', themeAuto: 'Podľa systému', themeLight: 'Svetlá', themeDark: 'Tmavá',
      sDensity: 'Hustota tabuliek', densComfortable: 'Pohodlná', densCompact: 'Kompaktná', sFont: 'Veľkosť písma',
      sFeatures: 'Funkcie', sTopBar: 'Úzka hlavička (namiesto veľkej hlavičky STU)', sToday: 'Rozvrh pod hlavičkou (týždeň, aktuálny čas)',
      sNotices: 'Oznamy a vývesku zlúčiť do jednej rozbaľovacej sekcie',
      sTableTools: 'Nástroje tabuliek (filter, zoradenie, kopírovanie, CSV)', sGrades: 'Farebné známky a súhrn hodnotení',
      sLang: 'Jazyk', langAuto: 'Podľa UIS',
      sData: 'Údaje o semestri', dataStatus: (w, t) => `Týždne: ${w ? 'načítané' : 'nenačítané'} · Rozvrh: ${t ? 'načítaný' : 'nenačítaný'}`,
      refreshNow: 'Obnoviť teraz', refreshing: 'Obnovujem…', refreshDone: 'Rozvrh a týždne obnovené', refreshFail: 'Rozvrh sa z UIS nepodarilo načítať',
      dataHelp: 'UIS+ si z UIS načíta váš rozvrh a prehľad týždňov (najviac dvakrát denne) a spolu s vašimi úpravami rozvrhu ich uchováva len v tomto prehliadači.',
      sPins: 'Pripnuté stránky', sPinsEmpty: 'Zatiaľ žiadne. Pripnete ich hviezdičkou v hlavičke.', remove: 'Odstrániť',
      sHelp: 'Pomoc', dump: 'Kopírovať štruktúru stránky', dumpHelp: 'Skopíruje rozloženie tejto stránky (značky a triedy, bez známok a osobných textov), aby sa skript dal pre ňu vylepšiť.',
      dumped: 'Štruktúra stránky skopírovaná do schránky', reset: 'Obnoviť UIS+', resetConfirm: 'Vymazať všetky nastavenia UIS+, pripnuté stránky a uložené údaje?',
      close: 'Zavrieť', shortcuts: 'Skratky: Ctrl+K hľadať · / filtrovať tabuľku · Esc zavrieť',
    },
  };
  const pageLang = () => {
    const fromUrl = /[;?&]lang=([a-z]{2})/i.exec(location.href);
    const fromMeta = document.querySelector('meta[name="lang"]');
    const code = (fromUrl ? fromUrl[1] : (fromMeta && fromMeta.content) || ROOT.lang || 'sk').slice(0, 2).toLowerCase();
    return code === 'en' ? 'en' : 'sk';
  };
  const lang = () => (settings.lang === 'auto' ? pageLang() : settings.lang);
  const locale = () => (lang() === 'sk' ? 'sk-SK' : 'en-GB');
  const t = (key, ...args) => {
    const v = (STR[lang()] || STR.en)[key] ?? STR.en[key];
    return typeof v === 'function' ? v(...args) : v;
  };

  /* ------------------------------------------------------------------ *
   * Styles                                                              *
   * Everything is scoped to html.aisx-on so "off" restores the original *
   * ------------------------------------------------------------------ */
  const CSS = String.raw`
html.aisx-on {
  --aisx-brand: #831135;
  --aisx-brand-ink: #6b0d2b;
  --aisx-brand-soft: #f8eaef;
  --aisx-bg: #f4f4f6;
  --aisx-surface: #ffffff;
  --aisx-surface-2: #f7f7f9;
  --aisx-border: #e3e3e8;
  --aisx-border-strong: #c9c9d1;
  --aisx-ink: #1d1d24;
  --aisx-muted: #63636f;
  --aisx-row-hover: rgba(131, 17, 53, .05);
  --aisx-zebra: rgba(20, 20, 40, .022);
  --aisx-radius: 10px;
  --aisx-shadow: 0 1px 2px rgba(16, 16, 32, .05), 0 1px 3px rgba(16, 16, 32, .05);
  --aisx-shadow-lg: 0 18px 50px rgba(16, 16, 32, .22);
  --aisx-font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --aisx-pad-y: 8px;
  --aisx-pad-x: 12px;
  --aisx-lec: #831135; --aisx-lec-bg: #f9edf1;
  --aisx-sem: #1f63b8; --aisx-sem-bg: #eaf2fc;
  --aisx-oth: #4d7c0f; --aisx-oth-bg: #eff6e4;
  --aisx-g-a: #1a7f45; --aisx-g-b: #4f9a1f; --aisx-g-c: #9c8600; --aisx-g-d: #c17a00; --aisx-g-e: #c75a12; --aisx-g-fx: #c42d2d;
}
html.aisx-on.aisx-compact { --aisx-pad-y: 4px; --aisx-pad-x: 8px; }

/* Dark mode: invert the light theme, then re-invert media and areas that were dark already
   (the header bar, photos) so they keep their real colours. */
html.aisx-on.aisx-dark {
  filter: invert(.92) hue-rotate(180deg);
  background-color: #ffffff !important;
  --aisx-bg: #ffffff;
  --aisx-surface: #eeeef1;
  --aisx-surface-2: #e7e7eb;
  --aisx-border: #d2d2d9;
  --aisx-border-strong: #b8b8c2;
  --aisx-shadow: none;
}
html.aisx-on.aisx-dark :is(img, video, picture, canvas, iframe, embed, object), html.aisx-on.aisx-dark .aisx-keepdark { filter: invert(1) hue-rotate(180deg); }
html.aisx-on.aisx-dark .aisx-keepdark :is(img, video, picture, canvas, iframe, embed, object) { filter: none; }
/* Home page section pictures are drawn inline (not images), so re-invert them too: they keep their real colours.
   AIS sets its own drop-shadow filter on them with a two-id selector, hence !important. */
html.aisx-on.aisx-dark .polozky-obr > svg { filter: invert(1) hue-rotate(180deg) !important; background: #f4f4f6; border-radius: 12px; box-shadow: 0 0 0 5px #f4f4f6; }

/* ---------- Base ---------- */
html.aisx-on body {
  margin: 0 !important;
  background: var(--aisx-bg) !important;
  color: var(--aisx-ink);
  font-family: var(--aisx-font) !important;
  font-size: var(--aisx-fs, 14px);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
html.aisx-on body *:not(i):not(code):not(pre):not(kbd):not(samp):not(svg):not(svg *):not([class*="icon"]):not([class*="fa-"]):not(.material-icons) {
  font-family: var(--aisx-font);
}
html.aisx-on ::selection { background: #f1c9d6; }
html.aisx-on a { color: var(--aisx-brand); text-underline-offset: 2px; }
html.aisx-on :focus-visible { outline: 2px solid var(--aisx-brand); outline-offset: 2px; }
html.aisx-on .aisx-hide { display: none !important; }
html.aisx-on.aisx-hasbar #hlavicka { display: none !important; }
html.aisx-on #base { margin: 0 auto !important; max-width: 1480px; padding: 0 20px; box-sizing: border-box; }

/* Breadcrumb row */
html.aisx-on nav[aria-label="breadcrumb"] {
  background: transparent !important; border: 0 !important; box-shadow: none !important;
  padding: 14px 0 6px !important; margin: 0 !important;
}
html.aisx-on nav[aria-label="breadcrumb"] .breadcrumb { background: transparent !important; margin: 0 !important; padding: 0 !important; font-size: 13px; }
html.aisx-on nav[aria-label="breadcrumb"] .breadcrumb-item, html.aisx-on nav[aria-label="breadcrumb"] .breadcrumb-item * { color: var(--aisx-muted); }
html.aisx-on nav[aria-label="breadcrumb"] .breadcrumb-item.active, html.aisx-on nav[aria-label="breadcrumb"] .breadcrumb-item.active * { color: var(--aisx-ink); font-weight: 600; }

/* Page title */
html.aisx-on .mainpage h1, html.aisx-on #titulek h1 {
  background: none !important; border: 0 !important; height: auto !important; padding: 0 !important;
  margin: 10px 0 4px !important; color: var(--aisx-ink) !important;
  font-size: 1.75em !important; font-weight: 700 !important; line-height: 1.25 !important; letter-spacing: -.015em;
}
html.aisx-on #titulek > div { color: var(--aisx-muted); font-size: 13px !important; }
html.aisx-on #titulek > div b { color: var(--aisx-ink); font-weight: 600; }
html.aisx-on hr.uisseparator { background: var(--aisx-border) !important; margin: 14px 0 !important; }
html.aisx-on .mainpage h2 { font-size: 1.3em; font-weight: 650; }
html.aisx-on :is(div.small, span.small, .small28, .small415, .xsmall28, .xsmall415, .ysmall, .xsmall, .ysmall28, .ysmall415) { width: auto !important; max-width: 820px; }
html.aisx-on div.small, html.aisx-on span.small { color: var(--aisx-muted); line-height: 1.5; }

/* Portal tabs (rendered by UIS as table.portal_menu) */
html.aisx-on table.portal_menu, html.aisx-on table.portal_menu > tbody { display: block !important; border: 0 !important; width: auto !important; }
html.aisx-on table.portal_menu > tbody > tr { display: flex !important; flex-wrap: wrap; gap: 6px; padding: 2px 0 10px; }
html.aisx-on table.portal_menu > tbody > tr > td { display: block !important; border: 0 !important; background: none !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
html.aisx-on table.portal_menu td b { font-weight: inherit; }
html.aisx-on table.portal_menu td a {
  display: inline-flex; align-items: center; height: 32px; padding: 0 14px; border-radius: 99px;
  background: var(--aisx-surface); border: 1px solid var(--aisx-border); color: var(--aisx-ink) !important;
  font-size: 13px; font-weight: 550; white-space: nowrap; text-decoration: none !important; transition: border-color .12s, color .12s;
}
html.aisx-on table.portal_menu td a:hover { border-color: var(--aisx-brand); color: var(--aisx-brand) !important; }
html.aisx-on table.portal_menu td.active a { background: var(--aisx-brand); border-color: var(--aisx-brand); color: #fff !important; }
html.aisx-on table.portal_menu + table.portal_menu > tbody > tr, html.aisx-on table.portal_menu ~ * table.portal_menu > tbody > tr { padding-top: 0; }
html.aisx-on table.portal_menu ~ table.portal_menu td a, html.aisx-on .aisx-subtabs td a { height: 28px; font-size: 12.5px; border-radius: 7px; }

/* Home page: notices and section tiles */
html.aisx-on .zasadka {
  background: var(--aisx-surface) !important; border: 1px solid var(--aisx-border) !important; border-left: 4px solid var(--aisx-brand) !important;
  border-radius: var(--aisx-radius) !important; box-shadow: var(--aisx-shadow) !important;
}
html.aisx-on .zasadka table, html.aisx-on .zasadka td { background: transparent !important; border: 0 !important; }
html.aisx-on .zasadka .toast { font-size: 13.5px; line-height: 1.5; }
html.aisx-on .polozky-obal .ramecek-boky {
  background: var(--aisx-surface) !important; border: 1px solid var(--aisx-border) !important;
  border-radius: 12px !important; box-shadow: var(--aisx-shadow) !important; overflow: hidden;
}
html.aisx-on .polozky-obal .ramecek-boky:hover { border-color: var(--aisx-border-strong) !important; }
html.aisx-on .sekce-nadpis, html.aisx-on .sekce-nadpis b { color: var(--aisx-ink) !important; font-size: 15px; font-weight: 700; }
html.aisx-on .polozky ul li a { font-size: 13.5px; }

/* ---------- Form controls ---------- */
html.aisx-on :is(input:is([type="text"], [type="password"], [type="search"], [type="email"], [type="number"], [type="date"], [type="tel"], [type="url"], :not([type])), select, textarea):not(.aisx-ui):not(.aisx-ui *) {
  font-family: inherit; font-size: max(13px, .95em); color: var(--aisx-ink);
  border-radius: 7px; transition: border-color .12s, box-shadow .12s;
}
html.aisx-on :is(input, select, textarea):not(.aisx-ui):not(.aisx-ui *):focus { border-color: var(--aisx-brand) !important; box-shadow: 0 0 0 3px rgba(131, 17, 53, .15) !important; outline: none; }
html.aisx-on :is(input[type="checkbox"], input[type="radio"]) { accent-color: var(--aisx-brand); }
html.aisx-on :is(input:is([type="submit"], [type="button"]), button):not(.aisx-ui):not(.aisx-ui *) { border-radius: 7px; cursor: pointer; }

/* Login page */
html.aisx-on #loginform {
  background: var(--aisx-surface) !important; border: 1px solid var(--aisx-border) !important;
  border-radius: 14px !important; box-shadow: 0 12px 34px rgba(16, 16, 32, .08) !important;
}
html.aisx-on #loginform input.reqfields { background: var(--aisx-surface) !important; border: 1px solid var(--aisx-border-strong) !important; height: 40px; padding: 0 12px; }
html.aisx-on #loginform :is(input[type="submit"], button) { background: var(--aisx-brand) !important; border-color: var(--aisx-brand) !important; color: #fff !important; }

/* ---------- Data tables ---------- */
html.aisx-on table.aisx-table {
  border-collapse: separate !important; border-spacing: 0 !important;
  background: var(--aisx-surface); border: 1px solid var(--aisx-border) !important;
  border-radius: var(--aisx-radius); box-shadow: var(--aisx-shadow); margin: 6px 0 18px;
}
html.aisx-on table.aisx-table > * > tr { background: transparent !important; }
html.aisx-on table.aisx-table > * > tr > :is(td, th) {
  padding: var(--aisx-pad-y) var(--aisx-pad-x) !important;
  border: 0 !important; border-bottom: 1px solid var(--aisx-border) !important;
  background-color: transparent;
  vertical-align: middle; line-height: 1.4;
}
html.aisx-on table.aisx-table > * > tr:last-child > :is(td, th) { border-bottom: 0 !important; }
html.aisx-on table.aisx-table > * > tr.aisx-head > :is(td, th) {
  background: var(--aisx-surface-2) !important; color: var(--aisx-muted) !important;
  font-weight: 650; font-size: .88em; white-space: nowrap;
  position: sticky; top: var(--aisx-sticky-top, 0px); z-index: 2;
  border-bottom: 1px solid var(--aisx-border-strong) !important;
}
html.aisx-on table.aisx-table > * > tr.aisx-head > :is(td, th) :not(svg):not(svg *) { color: inherit !important; }
html.aisx-on table.aisx-table > * > tr.aisx-head:first-child > :is(td, th):first-child { border-top-left-radius: var(--aisx-radius); }
html.aisx-on table.aisx-table > * > tr.aisx-head:first-child > :is(td, th):last-child { border-top-right-radius: var(--aisx-radius); }
html.aisx-on table.aisx-table > tbody > tr:not(.aisx-head):nth-child(even) > td { box-shadow: inset 0 0 0 9999px var(--aisx-zebra); }
html.aisx-on table.aisx-table > tbody > tr:not(.aisx-head):hover > td { box-shadow: inset 0 0 0 9999px var(--aisx-row-hover); }
html.aisx-on table.aisx-table .aisx-hidden { display: none !important; }
html.aisx-on table.aisx-table th.aisx-sortable { cursor: pointer; user-select: none; }
html.aisx-on table.aisx-table th.aisx-sortable:hover { color: var(--aisx-ink) !important; }
html.aisx-on table.aisx-table th.aisx-sortable::after { content: "↕"; opacity: .3; margin-left: 5px; font-size: .9em; }
html.aisx-on table.aisx-table th.aisx-sortable[data-aisx-sort="asc"]::after { content: "▲"; opacity: .9; color: var(--aisx-brand); }
html.aisx-on table.aisx-table th.aisx-sortable[data-aisx-sort="desc"]::after { content: "▼"; opacity: .9; color: var(--aisx-brand); }
html.aisx-on .aisx-scroll { overflow-x: auto; max-width: 100%; }
html.aisx-on .aisx-scroll > table.aisx-table > * > tr > :is(td, th) { position: static !important; }

/* Grade colouring */
html.aisx-on table.aisx-table > * > tr > td[class*="aisx-grade-"] { font-weight: 700; border-left: 3px solid transparent !important; }
html.aisx-on table.aisx-table > * > tr > td.aisx-grade-A { border-left-color: var(--aisx-g-a) !important; color: var(--aisx-g-a); }
html.aisx-on table.aisx-table > * > tr > td.aisx-grade-B { border-left-color: var(--aisx-g-b) !important; color: var(--aisx-g-b); }
html.aisx-on table.aisx-table > * > tr > td.aisx-grade-C { border-left-color: var(--aisx-g-c) !important; color: var(--aisx-g-c); }
html.aisx-on table.aisx-table > * > tr > td.aisx-grade-D { border-left-color: var(--aisx-g-d) !important; color: var(--aisx-g-d); }
html.aisx-on table.aisx-table > * > tr > td.aisx-grade-E { border-left-color: var(--aisx-g-e) !important; color: var(--aisx-g-e); }
html.aisx-on table.aisx-table > * > tr > td.aisx-grade-FX { border-left-color: var(--aisx-g-fx) !important; color: var(--aisx-g-fx); }

/* ---------- Timetable grid ---------- */
html.aisx-on table.aisx-timetable {
  border-collapse: separate !important; border-spacing: 0 !important; background: var(--aisx-surface);
  border: 1px solid var(--aisx-border) !important; border-radius: 12px; box-shadow: var(--aisx-shadow); overflow: hidden;
}
html.aisx-on table.aisx-timetable > * > tr > :is(td, th) { border: 0 !important; }
html.aisx-on table.aisx-timetable th.zahlavi {
  background: var(--aisx-surface-2) !important; color: var(--aisx-muted) !important;
  font-size: 11.5px; font-weight: 650; padding: 9px 0 !important; border-bottom: 1px solid var(--aisx-border) !important;
}
html.aisx-on table.aisx-timetable td.zahlavi {
  background: var(--aisx-surface-2) !important; color: var(--aisx-ink) !important;
  font-weight: 700; text-align: center !important; padding: 0 12px !important; border-right: 1px solid var(--aisx-border) !important;
}
html.aisx-on table.aisx-timetable tr.aisx-today > td.zahlavi { background: var(--aisx-brand) !important; color: #fff !important; }
html.aisx-on table.aisx-timetable tr.aisx-today > td:not(.zahlavi) { background: rgba(131, 17, 53, .025) !important; }
html.aisx-on table.aisx-timetable tr.rozvrh-sep > td { height: 1px; padding: 0 !important; background: var(--aisx-border) !important; }
html.aisx-on table.aisx-timetable td[class^="rozvrh-"]:not([class*="sep"]) {
  background: transparent !important; padding: 3px !important; vertical-align: top !important; border: 0 !important;
}
html.aisx-on table.aisx-timetable td[class^="rozvrh-"]:not([class*="sep"]) > div {
  position: relative; height: 100%; box-sizing: border-box; text-align: left;
  padding: 7px 9px; border-radius: 8px; font-size: 12.5px; line-height: 1.35;
  background: var(--aisx-oth-bg); border-left: 3px solid var(--aisx-oth); color: var(--aisx-ink);
  transition: opacity .15s, filter .15s;
}
html.aisx-on table.aisx-timetable td.rozvrh-pred:not([class*="sep"]) > div { background: var(--aisx-lec-bg); border-left-color: var(--aisx-lec); }
html.aisx-on table.aisx-timetable td.rozvrh-cvic:not([class*="sep"]) > div { background: var(--aisx-sem-bg); border-left-color: var(--aisx-sem); }
html.aisx-on table.aisx-timetable td[class^="rozvrh-"] > div a { color: inherit !important; }
html.aisx-on table.aisx-timetable td[class^="rozvrh-"] > div > a:first-child { color: var(--aisx-muted) !important; font-size: 11.5px; font-weight: 600; }
html.aisx-on table.aisx-timetable td[class^="rozvrh-"] > div > a:nth-of-type(2) { font-weight: 650; }
html.aisx-on table.aisx-timetable td[class^="rozvrh-"] > div i, html.aisx-on table.aisx-timetable td[class^="rozvrh-"] > div i a { color: var(--aisx-muted) !important; font-style: normal; font-size: 11.5px; }
html.aisx-on table.aisx-timetable td.aisx-offweek > div { opacity: .35; filter: grayscale(.7); }
html.aisx-on table.aisx-timetable td.aisx-offweek:hover > div { opacity: .8; }
html.aisx-on table.aisx-timetable td:is(.aisx-now, .aisx-next) > div { box-shadow: 0 0 0 2px var(--aisx-brand); }
html.aisx-on table.aisx-timetable td:is(.aisx-now, .aisx-next) > div::before {
  content: attr(data-aisx-label); position: absolute; top: -8px; right: 8px; padding: 1px 7px; border-radius: 99px;
  background: var(--aisx-brand); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase;
}
html.aisx-on .aisx-ttbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 6px 0 10px; font-size: 13px; color: var(--aisx-muted); }
html.aisx-on .aisx-ttbar .aisx-key { display: inline-flex; align-items: center; gap: 6px; color: var(--aisx-ink); font-weight: 550; }
html.aisx-on .aisx-ttbar .aisx-key i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
html.aisx-on .aisx-ttbar .aisx-btn { margin-left: auto; }
html.aisx-on .aisx-ttbar .aisx-btn.is-on { color: var(--aisx-g-a); border-color: transparent; background: transparent; cursor: default; }

/* ---------- UIS+ interface ---------- */
html:not(.aisx-on) .aisx-ui:not(.aisx-offpill) { display: none !important; }
html.aisx-on .aisx-offpill { display: none !important; }
.aisx-ui, .aisx-ui * { box-sizing: border-box; }
html.aisx-on .aisx-ui { font-family: var(--aisx-font); font-size: 13px; line-height: 1.35; color: var(--aisx-ink); }
html.aisx-on .aisx-ui svg { display: block; flex: none; }
html.aisx-on .aisx-ui a { text-decoration: none !important; }

html.aisx-on .aisx-btn, html.aisx-on .aisx-icon-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 30px; padding: 0 11px; margin: 0;
  font: 550 12.5px/1 var(--aisx-font); color: var(--aisx-ink);
  background: var(--aisx-surface); border: 1px solid var(--aisx-border); border-radius: 7px;
  cursor: pointer; white-space: nowrap; box-shadow: none;
}
html.aisx-on .aisx-icon-btn { width: 30px; padding: 0; color: var(--aisx-muted); }
html.aisx-on :is(.aisx-btn, .aisx-icon-btn):hover { background: var(--aisx-surface-2); border-color: var(--aisx-border-strong); color: var(--aisx-ink); }
html.aisx-on .aisx-btn.aisx-danger { color: var(--aisx-g-fx); }

/* Header bar */
html.aisx-on .aisx-bar {
  position: sticky; top: 0; z-index: 9990;
  display: flex; align-items: center; gap: 10px;
  height: 56px; padding: 0 16px 0 18px;
  background: var(--aisx-brand); color: #fff;
  box-shadow: 0 1px 0 rgba(0, 0, 0, .08), 0 2px 10px rgba(80, 0, 25, .18);
}
html.aisx-on .aisx-bar .aisx-logo { display: flex; align-items: center; height: 100%; flex: none; }
/* The STU logo image also carries the full university name, unreadable at this size; show only the mark. */
html.aisx-on .aisx-bar .aisx-logo:has(img) { width: 92px; overflow: hidden; }
html.aisx-on .aisx-bar .aisx-logo img { height: 31px; width: auto; max-width: none; display: block; }
html.aisx-on .aisx-bar .aisx-logo b { font: 800 20px/1 var(--aisx-font); letter-spacing: .12em; color: #fff; }
html.aisx-on .aisx-bar .aisx-sep { width: 1px; height: 26px; background: rgba(255, 255, 255, .22); flex: none; margin: 0 4px; }
html.aisx-on .aisx-bar .aisx-spacer { flex: 1 1 auto; min-width: 0; }
html.aisx-on .aisx-bar .aisx-tools { display: flex; align-items: center; gap: 2px; flex: none; }
html.aisx-on .aisx-bar .aisx-bbtn {
  position: relative; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px;
  border-radius: 9px; border: 0; background: transparent; color: rgba(255, 255, 255, .9) !important; cursor: pointer; padding: 0; text-decoration: none;
}
html.aisx-on .aisx-bar .aisx-bbtn:hover { background: rgba(255, 255, 255, .14); color: #fff !important; }
html.aisx-on .aisx-bar .aisx-lang { font: 700 11.5px/1 var(--aisx-font); width: auto; padding: 0 8px; letter-spacing: .04em; }
html.aisx-on .aisx-bar .aisx-profile {
  display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 8px 0 5px; margin-left: 4px; flex: none;
  border: 0; border-radius: 99px; background: transparent; color: #fff; font: 600 13px var(--aisx-font); white-space: nowrap; cursor: pointer;
}
html.aisx-on .aisx-bar .aisx-profile:hover, html.aisx-on .aisx-bar .aisx-profile[aria-expanded="true"] { background: rgba(255, 255, 255, .14); }
html.aisx-on .aisx-bar .aisx-avatar {
  position: relative; width: 30px; height: 30px; border-radius: 50%; background: rgba(255, 255, 255, .2);
  display: inline-flex; align-items: center; justify-content: center; font: 700 12px/1 var(--aisx-font);
}
html.aisx-on .aisx-bar .aisx-badge {
  position: absolute; top: -7px; right: -11px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 99px;
  background: #fff; color: var(--aisx-brand); font: 700 10.5px/17px var(--aisx-font); text-align: center; box-shadow: 0 0 0 2px var(--aisx-brand);
}
@media (max-width: 1000px) { html.aisx-on .aisx-bar .aisx-profile > .aisx-pname { display: none; } }
@media (max-width: 900px) {
  html.aisx-on .aisx-bar .aisx-logo img { height: 24px; }
  html.aisx-on .aisx-bar .aisx-logo:has(img) { width: 72px; }
}
@media (max-width: 640px) { html.aisx-on .aisx-bar .aisx-sep, html.aisx-on .aisx-bar .aisx-lang { display: none; } }

/* Profile menu: messages, documents, tasks, log out */
html.aisx-on .aisx-menu {
  position: fixed; z-index: 9996; width: 260px; padding: 6px; background: var(--aisx-surface);
  border: 1px solid var(--aisx-border); border-radius: 12px; box-shadow: var(--aisx-shadow-lg); animation: aisx-pop .12s ease-out;
}
html.aisx-on .aisx-menu-head { padding: 10px 10px 8px; border-bottom: 1px solid var(--aisx-border); margin-bottom: 4px; }
html.aisx-on .aisx-menu-head b { display: block; font-size: 14px; }
html.aisx-on .aisx-menu-head small { display: block; color: var(--aisx-muted); font-size: 12px; }
html.aisx-on .aisx-menu-head small.aisx-nd { margin-top: 3px; font-size: 11.5px; }
html.aisx-on .aisx-menu :is(a, .aisx-mi) {
  display: flex; align-items: center; gap: 10px; width: 100%; margin: 0; padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--aisx-ink) !important; font: 13.5px var(--aisx-font); text-align: left; cursor: pointer;
}
html.aisx-on .aisx-menu :is(a, .aisx-mi):hover { background: var(--aisx-surface-2); }
html.aisx-on .aisx-menu :is(a, .aisx-mi) svg { color: var(--aisx-muted); }
html.aisx-on .aisx-menu :is(a, .aisx-mi) > span:nth-child(2) { flex: 1; }
html.aisx-on .aisx-switch { position: relative; width: 32px; height: 18px; flex: none; border-radius: 99px; background: var(--aisx-border-strong); transition: background .15s; }
html.aisx-on .aisx-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s; }
html.aisx-on .aisx-mi[aria-checked="true"] .aisx-switch { background: var(--aisx-brand); }
html.aisx-on .aisx-mi[aria-checked="true"] .aisx-switch::after { transform: translateX(14px); }
html.aisx-on .aisx-menu .aisx-count { min-width: 22px; padding: 1px 7px; border-radius: 99px; background: var(--aisx-surface-2); color: var(--aisx-muted); font-size: 12px; font-weight: 650; text-align: center; }
html.aisx-on .aisx-menu .aisx-count.is-new { background: var(--aisx-brand); color: #fff; }
html.aisx-on .aisx-menu hr { margin: 4px 0; border: 0; border-top: 1px solid var(--aisx-border); }
html.aisx-on .aisx-menu a.aisx-danger { color: var(--aisx-g-fx) !important; }
html.aisx-on .aisx-menu a.aisx-danger svg { color: var(--aisx-g-fx); }

/* Top bar: where you are (breadcrumb), search, pin and help */
html.aisx-on .aisx-bar .aisx-crumbs { display: flex; align-items: center; gap: 1px; min-width: 0; flex: 0 1 auto; font-size: 13px; white-space: nowrap; }
html.aisx-on .aisx-bar .aisx-crumbs > * { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
html.aisx-on .aisx-bar .aisx-crumbs a { padding: 5px 7px; border-radius: 7px; color: rgba(255, 255, 255, .72) !important; }
html.aisx-on .aisx-bar .aisx-crumbs a:hover { background: rgba(255, 255, 255, .14); color: #fff !important; }
html.aisx-on .aisx-bar .aisx-crumbs a.aisx-home { display: inline-flex; flex: none; padding: 6px; overflow: visible; color: #fff !important; }
html.aisx-on .aisx-bar .aisx-crumb-sep { flex: none; overflow: visible; color: rgba(255, 255, 255, .4); }
html.aisx-on .aisx-bar .aisx-crumbs .is-current { padding: 5px 7px; color: #fff; font-weight: 650; }
html.aisx-on .aisx-bar .aisx-searchbtn {
  display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 8px 0 11px; width: 240px; flex: none; margin-right: 4px;
  border: 1px solid rgba(255, 255, 255, .2); border-radius: 9px; background: rgba(255, 255, 255, .1);
  color: rgba(255, 255, 255, .82); font: 13px var(--aisx-font); cursor: pointer; text-align: left;
}
html.aisx-on .aisx-bar .aisx-searchbtn:hover { background: rgba(255, 255, 255, .17); }
html.aisx-on .aisx-bar .aisx-searchbtn > span { flex: 1; }
html.aisx-on .aisx-bar .aisx-kbd { padding: 4px 6px; border: 0; border-radius: 5px; background: rgba(255, 255, 255, .16); color: #fff; font: 600 11px/1 var(--aisx-font); }
html.aisx-on .aisx-bar .aisx-bbtn.is-on { color: #ffd166 !important; }
html.aisx-on .aisx-bar .aisx-bbtn.is-active { background: rgba(255, 255, 255, .12); }
html.aisx-on.aisx-hascrumbs nav[aria-label="breadcrumb"] { display: none !important; }
@media (max-width: 1180px) { html.aisx-on .aisx-bar .aisx-searchbtn { width: 190px; } }
@media (max-width: 1000px) {
  html.aisx-on .aisx-bar .aisx-searchbtn { width: 36px; padding: 0; justify-content: center; }
  html.aisx-on .aisx-bar .aisx-searchbtn :is(span, .aisx-kbd) { display: none; }
}
@media (max-width: 760px) { html.aisx-on .aisx-bar .aisx-crumbs > :not(.aisx-home) { display: none; } }

/* Second row: pinned favourites only (shown when there are some) */
html.aisx-on .aisx-sub { background: var(--aisx-surface); border-bottom: 1px solid var(--aisx-border); }
html.aisx-on .aisx-sub-in { display: flex; align-items: center; max-width: 1480px; height: 44px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
html.aisx-on .aisx-pins { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; overflow-x: auto; scrollbar-width: none; }
html.aisx-on .aisx-pins::-webkit-scrollbar { display: none; }
html.aisx-on .aisx-pins a {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; max-width: 220px; flex: none;
  border: 1px solid var(--aisx-border); border-radius: 99px; color: var(--aisx-ink) !important; font-weight: 550;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
html.aisx-on .aisx-pins a:hover { border-color: var(--aisx-brand); color: var(--aisx-brand) !important; }
html.aisx-on .aisx-pins a.is-current { background: var(--aisx-brand-soft); border-color: transparent; color: var(--aisx-brand) !important; }
html.aisx-on .aisx-pins a svg { color: #d99a00; }
@media (max-width: 640px) { html.aisx-on .aisx-sub-in { padding: 0 12px; } }

/* Home page sections: close button and the row to bring hidden ones back */
html.aisx-on .polozky-obal { position: relative; }
html.aisx-on .polozky-obal.aisx-sec-hidden { display: none !important; }
html.aisx-on .aisx-sec-x {
  position: absolute; top: 7px; right: 8px; z-index: 5; display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--aisx-muted);
  cursor: pointer; opacity: .35; transition: opacity .12s, background .12s;
}
html.aisx-on .polozky-obal:hover .aisx-sec-x { opacity: 1; }
html.aisx-on .aisx-sec-x:hover { background: var(--aisx-surface-2); color: var(--aisx-ink); }
html.aisx-on .polozky-obal .menusectionclose { display: none !important; }
html.aisx-on .aisx-hidden-secs { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 18px 0 6px; font-size: 12.5px; color: var(--aisx-muted); }
html.aisx-on .aisx-hidden-secs button {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px dashed var(--aisx-border-strong);
  border-radius: 99px; background: var(--aisx-surface); color: var(--aisx-ink); font: 550 12.5px var(--aisx-font); cursor: pointer;
}
html.aisx-on .aisx-hidden-secs button:hover { border-style: solid; border-color: var(--aisx-brand); color: var(--aisx-brand); }
html.aisx-on .aisx-hidden-secs a { color: var(--aisx-brand) !important; font-weight: 600; margin-left: 4px; }

/* Timetable section under the header */
html.aisx-on .aisx-ts { background: var(--aisx-surface); border-bottom: 1px solid var(--aisx-border); }
html.aisx-on .aisx-ts-in { max-width: 1480px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
html.aisx-on .aisx-ts-head { display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; min-height: 56px; padding: 6px 0; }
html.aisx-on .aisx-ts-week { display: flex; align-items: center; gap: 6px; flex: none; }
html.aisx-on .aisx-ts-wk { padding: 0 6px; min-width: 168px; }
html.aisx-on .aisx-ts-wk b { display: block; font-size: 15px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; }
html.aisx-on .aisx-ts-wk small { display: block; color: var(--aisx-muted); font-size: 12px; margin-top: 1px; white-space: nowrap; }
html.aisx-on .aisx-ts-parity { display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 99px; background: var(--aisx-brand-soft); color: var(--aisx-brand); font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; vertical-align: 2px; }
html.aisx-on .aisx-ts-nav {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; flex: none;
  border: 1px solid var(--aisx-border); border-radius: 8px; background: var(--aisx-surface); color: var(--aisx-muted); cursor: pointer;
}
html.aisx-on .aisx-ts-nav:hover { color: var(--aisx-ink); border-color: var(--aisx-border-strong); }
html.aisx-on .aisx-ts-sum { display: flex; align-items: center; gap: 10px; flex: 1 1 280px; min-width: 0; font-size: 13.5px; }
html.aisx-on .aisx-ts-sum em { flex: none; padding: 3px 9px; border-radius: 99px; background: var(--aisx-brand); color: #fff; font-style: normal; font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
html.aisx-on .aisx-ts-sum em.is-soft { background: var(--aisx-brand-soft); color: var(--aisx-brand); }
html.aisx-on .aisx-ts-sum > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
html.aisx-on .aisx-ts-sum > span b { font-weight: 650; }
html.aisx-on .aisx-ts-sum > span i { font-style: normal; color: var(--aisx-muted); }
html.aisx-on .aisx-ts-actions { display: flex; align-items: center; gap: 6px; flex: none; margin-left: auto; }
html.aisx-on .aisx-ts-actions .aisx-nameday { margin-right: 6px; color: var(--aisx-muted); font-size: 12px; white-space: nowrap; }
html.aisx-on .aisx-ts-actions a.aisx-btn { color: var(--aisx-ink) !important; }
html.aisx-on .aisx-ts-body { overflow-x: auto; padding: 0 0 14px; }
html.aisx-on .aisx-ts-grid { --aisx-daycol: 66px; position: relative; min-width: 780px; }
html.aisx-on .aisx-ts-axis { position: relative; height: 22px; margin-left: var(--aisx-daycol); }
html.aisx-on .aisx-ts-axis span { position: absolute; top: 3px; transform: translateX(-50%); color: var(--aisx-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
html.aisx-on .aisx-ts-axis span:first-child { transform: none; }
html.aisx-on .aisx-ts-row { display: flex; border-top: 1px solid var(--aisx-border); }
html.aisx-on .aisx-ts-row:last-child { border-bottom: 1px solid var(--aisx-border); }
html.aisx-on .aisx-ts-row.is-today { background: rgba(131, 17, 53, .035); }
html.aisx-on .aisx-ts-day { width: var(--aisx-daycol); flex: none; padding: 9px 8px 0 0; font-size: 13px; font-weight: 700; }
html.aisx-on .aisx-ts-day small { display: block; color: var(--aisx-muted); font-size: 11.5px; font-weight: 500; }
html.aisx-on .aisx-ts-row.is-today .aisx-ts-day { color: var(--aisx-brand); }
html.aisx-on .aisx-ts-track {
  position: relative; flex: 1; min-height: 58px;
  background-image: linear-gradient(to right, var(--aisx-border) 1px, transparent 1px);
  background-size: calc(100% / var(--aisx-hours, 11)) 100%;
}
html.aisx-on .aisx-ts-l {
  position: absolute; height: 50px; box-sizing: border-box; padding: 6px 8px 5px; margin: 0;
  border: 0; border-left: 3px solid var(--aisx-oth); border-radius: 8px; background: var(--aisx-oth-bg);
  color: var(--aisx-ink); font: inherit; text-align: left; overflow: hidden; cursor: pointer; transition: box-shadow .12s, opacity .12s;
}
html.aisx-on .aisx-ts-l.k-pred { border-left-color: var(--aisx-lec); background: var(--aisx-lec-bg); }
html.aisx-on .aisx-ts-l.k-cvic { border-left-color: var(--aisx-sem); background: var(--aisx-sem-bg); }
html.aisx-on .aisx-ts-l:hover { box-shadow: 0 3px 10px rgba(16, 16, 32, .12); }
html.aisx-on .aisx-ts-l b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 650; }
html.aisx-on .aisx-ts-l b em { margin-right: 5px; padding: 1px 6px; border-radius: 99px; background: var(--aisx-brand); color: #fff; font-style: normal; font-size: 9.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; vertical-align: 1px; }
html.aisx-on .aisx-ts-l b em.is-soft { background: var(--aisx-surface); color: var(--aisx-brand); }
html.aisx-on .aisx-ts-l span { display: block; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--aisx-muted); font-size: 11.5px; }
html.aisx-on .aisx-ts-l.is-past { opacity: .45; }
html.aisx-on .aisx-ts-l.is-now { box-shadow: 0 0 0 2px var(--aisx-brand); }
html.aisx-on .aisx-ts-now { position: absolute; top: 18px; bottom: 0; width: 2px; margin-left: -1px; background: #e5383b; z-index: 3; pointer-events: none; }
html.aisx-on .aisx-ts-now::before { content: ""; position: absolute; top: 0; left: -4px; width: 10px; height: 10px; border-radius: 50%; background: #e5383b; }
html.aisx-on .aisx-ts-now span { position: absolute; top: -16px; left: 8px; padding: 0 3px; background: var(--aisx-surface); color: #e5383b; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
/* Collapsed: today's classes on one strip, with a left-to-right line showing how far the day has got */
html.aisx-on .aisx-ts-strip .aisx-ts-row { border-bottom: 1px solid var(--aisx-border); }
html.aisx-on .aisx-ts-strip .aisx-ts-day { color: var(--aisx-brand); }
html.aisx-on .aisx-ts-line { position: absolute; left: 0; right: 0; bottom: 9px; height: 3px; border-radius: 3px; background: var(--aisx-border); }
html.aisx-on .aisx-ts-line > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: #e5383b; }
html.aisx-on .aisx-ts-line > b { position: absolute; top: 50%; width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; border-radius: 50%; background: #e5383b; box-shadow: 0 0 0 3px var(--aisx-surface); }
html.aisx-on .aisx-ts-line > em { position: absolute; top: -17px; transform: translateX(-50%); padding: 0 3px; background: var(--aisx-surface); color: #e5383b; font-style: normal; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
html.aisx-on .aisx-ts-msg { padding: 4px 0 16px; color: var(--aisx-muted); font-size: 13px; display: flex; align-items: center; gap: 10px; }

/* Timetable view switcher (Week / Day / Mini) and the one-line Mini bar */
html.aisx-on .aisx-seg { display: inline-flex; padding: 2px; border: 1px solid var(--aisx-border); border-radius: 9px; background: var(--aisx-surface-2); flex: none; }
html.aisx-on .aisx-seg button { height: 26px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; color: var(--aisx-muted); font: 600 12px var(--aisx-font); cursor: pointer; }
html.aisx-on .aisx-seg button:hover { color: var(--aisx-ink); }
html.aisx-on .aisx-seg button.is-on { background: var(--aisx-surface); color: var(--aisx-ink); box-shadow: var(--aisx-shadow); }
html.aisx-on .aisx-ts.is-mini { position: relative; }
html.aisx-on .aisx-ts.is-mini .aisx-ts-head { min-height: 40px; padding: 3px 0; gap: 8px 14px; }
html.aisx-on .aisx-ts.is-mini .aisx-ts-wk { min-width: 0; padding: 0; display: inline-flex; align-items: center; gap: 8px; }
html.aisx-on .aisx-ts.is-mini .aisx-ts-wk b { font-size: 13px; }
html.aisx-on .aisx-ts.is-mini .aisx-ts-wk svg { color: var(--aisx-muted); }
html.aisx-on .aisx-ts.is-mini .aisx-ts-sum { font-size: 13px; }
html.aisx-on .aisx-ts.is-mini .aisx-seg button { height: 22px; font-size: 11.5px; }
html.aisx-on .aisx-ts-miniline { position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--aisx-border); }
html.aisx-on .aisx-ts-miniline > i { position: absolute; left: 0; top: 0; bottom: 0; background: #e5383b; }
@media (max-width: 760px) { html.aisx-on .aisx-ts.is-mini .aisx-ts-sum { display: none; } }

/* UIS statistics ("operinfo") folded into a small ∑ that opens on hover */
html.aisx-on .operinfo.aisx-egg {
  position: relative; box-sizing: border-box; width: max-content; max-width: 28px; height: 28px; margin: 28px 0 10px !important; padding: 0 !important; overflow: hidden;
  border: 1px solid var(--aisx-border) !important; border-radius: 99px; background: var(--aisx-surface) !important;
  color: transparent !important; font-size: 12px !important; line-height: 1.55; white-space: nowrap; opacity: .4; cursor: help;
  transition: max-width .4s ease, opacity .2s, border-radius .3s;
}
html.aisx-on .operinfo.aisx-egg b { color: inherit !important; }
html.aisx-on .operinfo.aisx-egg::before {
  content: "∑"; position: absolute; inset: 0; display: grid; place-items: center;
  color: var(--aisx-muted); font: 700 13px/1 var(--aisx-font); font-style: normal; transition: opacity .15s;
}
/* Lines stay unwrapped while it opens, so the box never jumps away from under the pointer. */
html.aisx-on .operinfo.aisx-egg:is(:hover, :focus) {
  max-width: 100%; height: auto; padding: 10px 14px !important; border-radius: 12px;
  color: var(--aisx-muted) !important; opacity: 1; cursor: default; outline: none;
}
html.aisx-on .operinfo.aisx-egg:is(:hover, :focus) b { color: var(--aisx-ink) !important; }
html.aisx-on .operinfo.aisx-egg:is(:hover, :focus)::before { opacity: 0; }
@media (max-width: 760px) { html.aisx-on .operinfo.aisx-egg:is(:hover, :focus) { white-space: normal; width: auto; } }

/* UIS help panel: note about its language */
html.aisx-on .aisx-help-note { margin: 0 0 10px; padding: 7px 12px; border-radius: 8px; background: var(--aisx-surface-2); color: var(--aisx-muted); font-size: 12.5px; }

/* Notices and noticeboard combined into one drop-down (home page) */
html.aisx-on .aisx-notices-head {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; width: 100%; margin: 14px 0 10px; padding: 11px 16px;
  background: var(--aisx-surface); border: 1px solid var(--aisx-border); border-radius: 12px; box-shadow: var(--aisx-shadow);
  color: var(--aisx-ink); font: 650 14px var(--aisx-font); text-align: left; cursor: pointer;
}
html.aisx-on .aisx-notices-head:hover { border-color: var(--aisx-border-strong); }
html.aisx-on .aisx-notices-head > b { margin-right: 4px; }
html.aisx-on .aisx-np { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 650; }
html.aisx-on .aisx-np i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
html.aisx-on .aisx-np.n-red { background: #fde8e7; color: #b42318; }
html.aisx-on .aisx-np.n-blue { background: #e6f0fb; color: #1f63b8; }
html.aisx-on .aisx-np.n-yellow { background: #fdf2cc; color: #8a5a00; }
html.aisx-on .aisx-nh-toggle { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; color: var(--aisx-muted); font-size: 12.5px; font-weight: 550; }
html.aisx-on .zasadky-container.aisx-notices-box { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 10px; margin: 0 0 16px !important; }
html.aisx-on .zasadky-container.aisx-notices-box.is-collapsed { display: none !important; }
html.aisx-on .aisx-notices-box > .zasadka { margin: 0 !important; width: auto !important; max-width: none !important; padding: 12px 14px 8px !important; }
html.aisx-on .aisx-notices-box > .zasadka.n-red { border-left-color: #d92d20 !important; }
html.aisx-on .aisx-notices-box > .zasadka.n-blue { border-left-color: #1f63b8 !important; }
html.aisx-on .aisx-notices-box > .zasadka.n-yellow { border-left-color: #e0a800 !important; }
html.aisx-on .aisx-notices-box > .zasadka::before { content: attr(data-aisx-label); display: block; margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
html.aisx-on .aisx-notices-box > .zasadka.n-red::before { color: #b42318; }
html.aisx-on .aisx-notices-box > .zasadka.n-blue::before { color: #1f63b8; }
html.aisx-on .aisx-notices-box > .zasadka.n-yellow::before { color: #8a5a00; }
html.aisx-on .aisx-notices-box .zasadka table { width: 100%; }
html.aisx-on .aisx-notices-box .zasadka > table > tbody > tr > td { padding: 0 !important; }
html.aisx-on .aisx-notices-box .zasadka > table > tbody > tr > td:first-child { display: none !important; }
html.aisx-on .aisx-notices-box .zasadka.vyveska td > b:first-child { display: none; }
html.aisx-on .aisx-notices-box .zasadka ul { margin: 0 !important; padding: 0 !important; }
html.aisx-on .aisx-notices-box .zasadka li { margin: 0 0 5px !important; padding: 0 !important; background: none !important; font-size: 13px !important; line-height: 1.45; }

/* Timetable editor */
html.aisx-on .aisx-panel.aisx-wide { width: min(880px, 100%); max-height: 86vh; }
html.aisx-on .aisx-btn.aisx-primary { background: var(--aisx-brand); border-color: var(--aisx-brand); color: #fff; }
html.aisx-on .aisx-btn.aisx-primary:hover { background: var(--aisx-brand-ink); border-color: var(--aisx-brand-ink); color: #fff; }
html.aisx-on .aisx-ed-radio { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13.5px; cursor: pointer; }
html.aisx-on .aisx-ed-radio input { accent-color: var(--aisx-brand); }
html.aisx-on .aisx-ed-current { margin: 2px 0 0 24px; color: var(--aisx-muted); font-size: 12px; }
html.aisx-on .aisx-crit {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px 12px;
  margin: 8px 0 0; padding: 12px; background: var(--aisx-surface-2); border: 1px solid var(--aisx-border); border-radius: 10px;
}
html.aisx-on .aisx-crit > p { grid-column: 1 / -1; margin: 0; }
html.aisx-on .aisx-crit label { display: flex; flex-direction: column; gap: 4px; min-width: 0; color: var(--aisx-muted); font-size: 12px; font-weight: 600; }
html.aisx-on .aisx-crit select { width: 100%; }
html.aisx-on .aisx-crit-actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; }
html.aisx-on .aisx-ed-msg { font-size: 12.5px; color: var(--aisx-muted); }
html.aisx-on .aisx-ed-msg.is-err { color: var(--aisx-g-fx); }
html.aisx-on .aisx-ed-day { margin: 14px 0 4px; color: var(--aisx-muted); font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
html.aisx-on .aisx-ed-row { display: flex; align-items: center; gap: 10px; padding: 5px 8px; border-radius: 8px; font-size: 13px; }
html.aisx-on .aisx-ed-row:hover { background: var(--aisx-surface-2); }
html.aisx-on .aisx-ed-row.is-focus { box-shadow: inset 0 0 0 2px var(--aisx-brand); }
html.aisx-on .aisx-ed-row.is-hidden :is(.aisx-ed-time, .aisx-ed-title, .aisx-ed-meta, .aisx-ed-dot) { opacity: .4; }
html.aisx-on .aisx-ed-row.is-hidden .aisx-ed-title { text-decoration: line-through; }
html.aisx-on .aisx-ed-time { flex: none; width: 92px; font-weight: 650; font-variant-numeric: tabular-nums; }
html.aisx-on .aisx-ed-dot { flex: none; width: 10px; height: 10px; border-radius: 3px; background: var(--aisx-oth); }
html.aisx-on .aisx-ed-dot.k-pred { background: var(--aisx-lec); }
html.aisx-on .aisx-ed-dot.k-cvic { background: var(--aisx-sem); }
html.aisx-on .aisx-ed-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
html.aisx-on .aisx-ed-tag { margin-left: 6px; padding: 1px 7px; border-radius: 99px; background: var(--aisx-brand-soft); color: var(--aisx-brand); font-size: 10.5px; font-weight: 700; vertical-align: 1px; }
html.aisx-on .aisx-ed-meta { flex: none; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--aisx-muted); font-size: 12px; }
html.aisx-on .aisx-ed-form {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 10px;
  margin: 4px 0 10px; padding: 12px; background: var(--aisx-surface-2); border: 1px solid var(--aisx-border); border-radius: 10px;
}
html.aisx-on .aisx-ed-form label { display: flex; flex-direction: column; gap: 4px; min-width: 0; color: var(--aisx-muted); font-size: 12px; font-weight: 600; }
html.aisx-on .aisx-ed-form label.is-wide { grid-column: span 2; }
html.aisx-on .aisx-ed-form :is(input, select) {
  width: 100%; height: 30px; padding: 0 8px; font: 13px var(--aisx-font); color: var(--aisx-ink);
  background: var(--aisx-surface); border: 1px solid var(--aisx-border-strong); border-radius: 7px;
}
html.aisx-on .aisx-ed-actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; }
html.aisx-on .aisx-ed-foot { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
@media (max-width: 640px) {
  html.aisx-on .aisx-ed-form { grid-template-columns: 1fr 1fr; }
  html.aisx-on .aisx-ed-meta, html.aisx-on .aisx-ts-actions .aisx-nameday { display: none; }
}

/* Table toolbar */
html.aisx-on .aisx-tt { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0 0; max-width: 100%; }
html.aisx-on .aisx-tt-search { position: relative; display: inline-flex; align-items: center; }
html.aisx-on .aisx-tt-search svg { position: absolute; left: 9px; color: var(--aisx-muted); pointer-events: none; }
html.aisx-on .aisx-ui input.aisx-tt-filter {
  width: 220px; height: 30px; min-height: 30px; padding: 0 10px 0 30px; margin: 0;
  font: 13px var(--aisx-font); color: var(--aisx-ink); background: var(--aisx-surface); border: 1px solid var(--aisx-border-strong); border-radius: 7px; outline: none;
}
html.aisx-on .aisx-ui input.aisx-tt-filter:focus { border-color: var(--aisx-brand); box-shadow: 0 0 0 3px rgba(131, 17, 53, .15); }
html.aisx-on .aisx-tt-count { color: var(--aisx-muted); font-size: 12px; margin-right: auto; }

/* Grade card */
html.aisx-on .aisx-card { background: var(--aisx-surface); border: 1px solid var(--aisx-border); border-radius: 12px; box-shadow: var(--aisx-shadow); padding: 14px 16px; margin: 12px 0 4px; max-width: 760px; }
html.aisx-on .aisx-card h4 { margin: 0 0 10px; font-size: 12px; font-weight: 700; color: var(--aisx-muted); text-transform: uppercase; letter-spacing: .05em; }
html.aisx-on .aisx-stats { display: flex; flex-wrap: wrap; gap: 10px 28px; }
html.aisx-on .aisx-stat b { display: block; font-size: 24px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; font-variant-numeric: tabular-nums; }
html.aisx-on .aisx-stat small { display: block; color: var(--aisx-muted); font-size: 12px; margin-top: 2px; }
html.aisx-on .aisx-dist { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
html.aisx-on .aisx-dist span { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 99px; font-weight: 650; font-size: 12px; color: #fff; }
html.aisx-on .aisx-dist span i { font-style: normal; font-weight: 500; opacity: .9; }
html.aisx-on .aisx-note { margin: 10px 0 0; color: var(--aisx-muted); font-size: 11.5px; }

/* Overlay panels (search, settings) */
html.aisx-on .aisx-overlay {
  position: fixed; inset: 0; z-index: 2147483000; background: rgba(20, 10, 18, .4);
  display: flex; align-items: flex-start; justify-content: center; padding: 11vh 16px 16px;
  animation: aisx-fade .12s ease-out;
}
html.aisx-on .aisx-panel {
  width: min(640px, 100%); max-height: 78vh; display: flex; flex-direction: column;
  background: var(--aisx-surface); border: 1px solid var(--aisx-border); border-radius: 14px; box-shadow: var(--aisx-shadow-lg); overflow: hidden;
  animation: aisx-pop .14s ease-out;
}
@keyframes aisx-fade { from { opacity: 0; } }
@keyframes aisx-pop { from { opacity: 0; transform: translateY(-6px) scale(.985); } }
html.aisx-on .aisx-pal-head { display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid var(--aisx-border); color: var(--aisx-muted); }
html.aisx-on .aisx-ui input.aisx-pal-input {
  flex: 1; height: 54px; min-height: 0; border: 0; box-shadow: none; padding: 0; margin: 0;
  font: 16px var(--aisx-font); background: transparent; color: var(--aisx-ink); outline: none;
}
html.aisx-on .aisx-kbd { font: 600 11px/1 var(--aisx-font); padding: 3px 5px; border-radius: 4px; border: 1px solid var(--aisx-border); background: var(--aisx-surface); color: var(--aisx-muted); }
html.aisx-on .aisx-pal-list { overflow-y: auto; padding: 6px; }
html.aisx-on .aisx-pal-item { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 8px; color: var(--aisx-ink) !important; cursor: pointer; }
html.aisx-on .aisx-pal-item.is-active { background: var(--aisx-brand-soft); }
html.aisx-on .aisx-pal-kind { flex: none; width: 62px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--aisx-muted); }
html.aisx-on .aisx-pal-item.is-active .aisx-pal-kind { color: var(--aisx-brand); }
html.aisx-on .aisx-pal-text { display: flex; flex-direction: column; min-width: 0; }
html.aisx-on .aisx-pal-title { font-weight: 550; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
html.aisx-on .aisx-pal-sub { color: var(--aisx-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
html.aisx-on .aisx-pal-empty { padding: 22px 16px; color: var(--aisx-muted); text-align: center; line-height: 1.5; }
html.aisx-on .aisx-pal-foot { padding: 8px 16px; border-top: 1px solid var(--aisx-border); color: var(--aisx-muted); font-size: 11.5px; background: var(--aisx-surface-2); }

html.aisx-on .aisx-set-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--aisx-border); }
html.aisx-on .aisx-set-head b { font-size: 15px; }
html.aisx-on .aisx-set-head small { color: var(--aisx-muted); margin-left: 6px; }
html.aisx-on .aisx-set-body { overflow-y: auto; padding: 6px 18px 18px; }
html.aisx-on .aisx-set-body h5 { margin: 16px 0 8px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--aisx-muted); }
html.aisx-on .aisx-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 7px 0; border-bottom: 1px solid var(--aisx-border); }
html.aisx-on .aisx-row:last-child { border-bottom: 0; }
html.aisx-on .aisx-row > label, html.aisx-on .aisx-row > span { flex: 1; font-size: 13px; }
html.aisx-on .aisx-ui select { height: 30px; padding: 0 8px; font: 13px var(--aisx-font); color: var(--aisx-ink); background: var(--aisx-surface); border: 1px solid var(--aisx-border-strong); border-radius: 7px; }
html.aisx-on .aisx-ui input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--aisx-brand); }
html.aisx-on .aisx-ui input[type="range"] { width: 140px; accent-color: var(--aisx-brand); }
html.aisx-on .aisx-help { color: var(--aisx-muted); font-size: 12px; margin: 6px 0 0; line-height: 1.45; }
html.aisx-on .aisx-pinrow { display: flex; gap: 8px; align-items: center; padding: 5px 0; }
html.aisx-on .aisx-ui .aisx-pinrow input { flex: 1; height: 30px; padding: 0 8px; font: 13px var(--aisx-font); border: 1px solid var(--aisx-border-strong); border-radius: 7px; background: var(--aisx-surface); color: var(--aisx-ink); }

html.aisx-on .aisx-toast {
  position: fixed; left: 50%; bottom: 24px; z-index: 2147483001; transform: translateX(-50%);
  background: #1d1d24; color: #fff; padding: 10px 16px; border-radius: 9px; box-shadow: var(--aisx-shadow-lg);
  font: 13px/1.4 var(--aisx-font); animation: aisx-pop .15s ease-out; max-width: calc(100vw - 32px);
}
.aisx-offpill {
  position: fixed; left: 14px; bottom: 14px; z-index: 2147483000; padding: 6px 12px; border-radius: 99px;
  font: 600 12px/1.2 system-ui, sans-serif; background: #831135; color: #fff; border: 0; cursor: pointer; opacity: .8;
}
.aisx-offpill:hover { opacity: 1; }
@media print {
  html.aisx-on { filter: none !important; }
  html.aisx-on :is(.aisx-bar, .aisx-sub, .aisx-ts, .aisx-tt, .aisx-ttbar, .aisx-toast, .aisx-overlay, .aisx-menu) { display: none !important; }
  html.aisx-on.aisx-hascrumbs nav[aria-label="breadcrumb"] { display: block !important; }
  html.aisx-on.aisx-hasbar #hlavicka { display: block !important; }
}
`;

  const addStyle = css => {
    if (typeof GM_addStyle === 'function') {
      try {
        GM_addStyle(css);
        return;
      } catch (e) {
        /* fall through */
      }
    }
    const style = document.createElement('style');
    style.id = 'aisx-style';
    style.textContent = css;
    (document.head || ROOT).appendChild(style);
  };

  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => settings.theme === 'dark' || (settings.theme === 'auto' && !!darkQuery && darkQuery.matches);
  function applyTheme() {
    if (!ROOT) return;
    ROOT.classList.toggle('aisx-on', !!settings.enabled);
    ROOT.classList.toggle('aisx-dark', !!settings.enabled && isDark());
    ROOT.classList.toggle('aisx-compact', settings.density === 'compact');
    ROOT.style.setProperty('--aisx-fs', settings.fontSize + 'px');
    refreshBar();
  }

  // Applied before the page paints, so there is no flash of the old look.
  function applyEarly() {
    ROOT = document.documentElement;
    addStyle(CSS);
    applyTheme();
  }
  if (document.documentElement) applyEarly();
  else {
    new MutationObserver((_, observer) => {
      if (!document.documentElement) return;
      observer.disconnect();
      applyEarly();
    }).observe(document, { childList: true });
  }
  if (darkQuery) {
    const onScheme = () => settings.theme === 'auto' && applyTheme();
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onScheme);
    else if (darkQuery.addListener) darkQuery.addListener(onScheme);
  }

  /* ------------------------------------------------------------------ *
   * Helpers                                                             *
   * ------------------------------------------------------------------ */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    star: '<path d="M12 3.6l2.55 5.2 5.75.83-4.16 4.05.98 5.72L12 16.7l-5.12 2.7.98-5.72L3.7 9.63l5.75-.83z"/>',
    moon: '<path d="M20 14.6A8 8 0 0 1 9.4 4a8 8 0 1 0 10.6 10.6z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    download: '<path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    power: '<path d="M12 3v8"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    tick: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h4.5v-6h4v6h4.5V9.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.5M12 17h.01"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H12"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  };
  const icon = (name, size = 16, filled = false) => {
    const span = document.createElement('span');
    span.style.display = 'contents';
    span.innerHTML =
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${filled ? 'currentColor' : 'none'}" ` +
      `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
    return span;
  };

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k in el && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : String(kid));
    }
    return el;
  }

  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const norm = s => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const urlKey = u => String(u).split('#')[0];
  const isTyping = el => !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
  const LOGOUT_RE = /logout|odhlas|odhlás|log\s*out|sign\s*out/i;
  // Signed-in pages live under /auth/ and carry a log-out link; the public UIS pages have the same header
  // boxes, only empty, so their presence alone is not enough (nothing personal may show when logged out).
  const loggedIn = () =>
    location.pathname.startsWith('/auth') && !!document.querySelector('a[href*="logout.pl"]') && !document.querySelector('input[name="credential_1"]');

  function pageTitle() {
    // Portal pages share one h1 ("Portál študenta"); their active tabs say which page it is.
    const tabs = Array.from(document.querySelectorAll('table.portal_menu td.active a')).map(a => clean(a.textContent)).filter(Boolean);
    if (tabs.length) return tabs.slice(0, 2).join(' · ').slice(0, 90);
    const h1 = Array.from(document.querySelectorAll('h1')).find(el => !el.closest('.aisx-ui') && clean(el.textContent));
    const crumb = document.querySelector('.breadcrumb-item.active');
    const title = (h1 && clean(h1.textContent)) || (crumb && clean(crumb.textContent));
    return (title || clean(document.title.split(/\s[–—|-]\s/)[0]) || location.pathname).slice(0, 90);
  }

  let toastTimer = null;
  function toast(msg) {
    document.querySelectorAll('.aisx-toast').forEach(el => el.remove());
    const el = h('div', { class: 'aisx-ui aisx-toast', role: 'status' }, msg);
    document.body.append(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  function downloadText(filename, text, type) {
    const blob = new Blob(['﻿' + text], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: filename, style: 'display:none' });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  // Runs each feature on its own, so one failing on an unusual page does not stop the others.
  const safely = (name, fn) => {
    try {
      return fn();
    } catch (e) {
      console.warn('[UIS+] ' + name + ' failed:', e);
    }
  };

  /* ------------------------------------------------------------------ *
   * Dates and times                                                      *
   * ------------------------------------------------------------------ */
  const pad2 = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmtMin = m => `${Math.floor(m / 60)}:${pad2(m % 60)}`;
  const nowMin = d => d.getHours() * 60 + d.getMinutes();
  // UIS writes dates as "21.09.2026" / "21. 09. 2026" in Slovak and "09/21/2026" in English.
  function parseAisDate(s) {
    let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
    m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(s);
    return m ? `${m[3]}-${pad2(m[2])}-${pad2(m[1])}` : null;
  }
  const allAisDates = s => (s.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/g) || []).map(parseAisDate);
  const DAY_INDEX = { po: 1, ut: 2, 'út': 2, st: 3, 'št': 4, 'čt': 4, pi: 5, 'pá': 5, so: 6, ne: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
  const dayIndex = s => {
    const k = clean(s).toLowerCase();
    return DAY_INDEX[k] ?? DAY_INDEX[k.slice(0, 3)] ?? DAY_INDEX[k.slice(0, 2)] ?? null;
  };
  const weekdayName = (d, style = 'long') => new Intl.DateTimeFormat(locale(), { weekday: style }).format(d);
  const shortDate = d => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'numeric' }).format(d);

  /* ------------------------------------------------------------------ *
   * Semester data: academic weeks and the personal timetable             *
   * Both come from UIS pages the student can open anyway; cached locally. *
   * ------------------------------------------------------------------ */
  const getIds = () => store.get('ids', {});
  const getCal = () => store.get('cal', {});
  const setCal = patch => store.set('cal', Object.assign(getCal(), patch));

  // The study, period and timetable ids appear in links on most student pages.
  function learnIds(root) {
    const ids = getIds();
    let changed = false;
    for (const a of root.querySelectorAll('a[href*="rozvrh_student="], a[href*="studium="]')) {
      const href = a.getAttribute('href');
      const r = /rozvrh_student=(\d+)/.exec(href);
      const s = /[?;&]studium=(\d+)[;&,]obdobi=(\d+)/.exec(href) || /[?;&]obdobi=(\d+)[;&,]studium=(\d+)/.exec(href);
      if (r && ids.rozvrh !== r[1]) {
        ids.rozvrh = r[1];
        changed = true;
      }
      if (s) {
        const [studium, obdobi] = /obdobi=\d+[;&,]studium/.test(s[0]) ? [s[2], s[1]] : [s[1], s[2]];
        if (ids.studium !== studium || ids.obdobi !== obdobi) {
          Object.assign(ids, { studium, obdobi });
          changed = true;
        }
      }
    }
    if (changed) store.set('ids', ids);
    return changed;
  }

  function parseWeeks(doc) {
    for (const table of doc.querySelectorAll('table')) {
      const weeks = [];
      for (const row of table.rows) {
        const cells = Array.from(row.cells).map(c => clean(c.textContent));
        if (cells.length < 4) continue;
        const from = parseAisDate(cells[1]);
        const to = parseAisDate(cells[2]);
        const n = parseInt(cells[0], 10);
        if (!from || !to || !n) continue;
        const parity = norm(cells[3]);
        weeks.push({ n, from, to, odd: /nep|odd|lich/.test(parity) });
      }
      if (weeks.length >= 3) return weeks;
    }
    return null;
  }

  // The grid is a table whose header lists hourly slots ("8.00-8.50", colspan 10, then a 2-column gap);
  // a lesson cell's position and colspan therefore translate to minutes from the first slot.
  function parseTimetable(doc, keepCells) {
    const sample = doc.querySelector('td.rozvrh-pred, td.rozvrh-cvic, td[class^="rozvrh-"]:not(.rozvrh-sep)');
    const grid = sample && sample.closest('table');
    if (!grid) return null;
    const head = grid.rows[0];
    const SLOT_RE = /(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/;
    let origin = null;
    let unit = 5;
    let pos = 0;
    const slots = [];
    for (const th of Array.from(head.cells).slice(1)) {
      const m = SLOT_RE.exec(th.textContent);
      if (m) slots.push({ pos, start: +m[1] * 60 + +m[2], end: +m[3] * 60 + +m[4], span: th.colSpan });
      pos += th.colSpan;
    }
    if (!slots.length) return null;
    origin = slots[0].start;
    unit = slots.length > 1 ? (slots[1].start - slots[0].start) / (slots[1].pos - slots[0].pos) : (slots[0].end - slots[0].start) / slots[0].span;

    const notes = {};
    for (const row of doc.querySelectorAll('tr')) {
      if (row.cells.length < 2) continue;
      const m = /^\((\d+)\)$/.exec(clean(row.cells[0].textContent));
      if (m) notes[m[1]] = clean(row.cells[1].textContent);
    }

    const lessons = [];
    let day = null;
    for (const row of Array.from(grid.rows).slice(1)) {
      if (row.classList.contains('rozvrh-sep') || !row.cells.length) continue;
      const first = row.cells[0];
      const label = clean(first.textContent);
      if (label) day = dayIndex(label);
      let col = 0;
      for (const cell of Array.from(row.cells).slice(1)) {
        const kind = (/(?:^|\s)rozvrh-(\w+)/.exec(cell.className) || [])[1];
        if (kind && kind !== 'sep' && day != null) {
          const links = Array.from(cell.querySelectorAll('a'));
          const teacherEl = cell.querySelector('i');
          // Judge links by their target only: UIS appends a "zpet=" back-link that can mention any page.
          const target = a => (a.getAttribute('href') || '').split(/[;?&]zpet=/)[0];
          const course = links.find(a => /syllabus\.pl|[?;&]predmet=/.test(target(a))) || links[1] || links[0];
          const room = links.find(a => /mistnost/.test(target(a))) || null;
          const refs = ((cell.querySelector('sup') || {}).textContent || '').match(/\d+/g) || [];
          const noteText = refs.map(r => notes[r] || '').join(' | ');
          const nt = norm(noteText);
          const lesson = {
            day,
            start: Math.round(origin + col * unit),
            end: Math.round(origin + (col + cell.colSpan) * unit),
            kind,
            title: clean(course ? course.textContent : cell.textContent).slice(0, 120),
            cid: ((course && /[?;&]predmet=(\d+)/.exec(target(course))) || [])[1] || null,
            room: room ? clean(room.textContent).replace(/\s*\(.*\)\s*$/, '') : '',
            teacher: teacherEl ? clean(teacherEl.textContent) : '',
            parity: /neparn|odd week|lich/.test(nt) ? 'odd' : /parn|even week|sud/.test(nt) ? 'even' : null,
            off: /voln|day off|volno/.test(nt) ? allAisDates(noteText).filter(Boolean) : [],
          };
          if (keepCells) lesson.cell = cell;
          lessons.push(lesson);
        }
        col += cell.colSpan;
      }
    }
    if (!lessons.length) return null;
    const text = clean((doc.querySelector('.mainpage') || doc.body).textContent);
    const valid = /(?:Platnos\S*|Validity|Platnost)\s*:\s*([\d./ ]+?\d{4})\s*[-–]\s*([\d./ ]+?\d{4})/.exec(text);
    return { lessons, from: valid ? parseAisDate(valid[1]) : null, to: valid ? parseAisDate(valid[2]) : null };
  }

  // A form post is used for timetables chosen by criteria; it only displays data, like the UIS page does.
  async function fetchDoc(path, postParams) {
    const init = { credentials: 'same-origin' };
    if (postParams) Object.assign(init, { method: 'POST', body: new URLSearchParams(postParams) });
    const res = await fetch(path, init);
    if (!res.ok && res.status !== 403) throw new Error('HTTP ' + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    if (doc.querySelector('input[name="credential_1"]')) throw new Error('logged out');
    return doc;
  }

  // Where the timetable comes from: null = the student's personal timetable,
  // or { title, params } = an UIS timetable chosen by criteria (posted to rozvrhy_view.pl).
  const TT_VIEW = '/auth/katalog/rozvrhy_view.pl';
  const getSource = () => store.get('ttSource', null);
  const sourceKey = src => (src ? 'q:' + JSON.stringify(src.params) : getIds().rozvrh || null);
  const docTitle = doc => clean(((doc.querySelector('#titulek h1, .mainpage h1') || {}).textContent) || '');

  // Fetched in the language UIS+ shows ("lang" only affects that one response, not the UIS session).
  async function loadSourceTimetable(src) {
    let doc;
    if (src) doc = await fetchDoc(TT_VIEW, Object.assign({}, src.params, { lang: lang() }));
    else if (getIds().rozvrh) doc = await fetchDoc(`${TT_VIEW}?zobraz=1;format=html;rozvrh_student=${getIds().rozvrh};lang=${lang()}`);
    else return null;
    const tt = parseTimetable(doc);
    return tt && Object.assign(tt, { title: docTitle(doc) });
  }

  let refreshing = null;
  function refreshData(force) {
    if (!settings.today || !loggedIn()) return Promise.resolve(false);
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const stale = at => force || !at || Date.now() - at > 12 * 3600e3;
      let ids = getIds();
      if (!ids.rozvrh || !ids.studium) {
        learnIds(await fetchDoc('/auth/student/moje_studium.pl'));
        ids = getIds();
      }
      const cal = getCal();
      if (ids.studium && ids.obdobi && (stale(cal.weeksAt) || cal.weeksKey !== ids.studium + '/' + ids.obdobi)) {
        const weeks = parseWeeks(await fetchDoc(`/auth/ca/prehled_tydnu.pl?studium=${ids.studium};obdobi=${ids.obdobi}`));
        if (weeks) setCal({ weeks, weeksAt: Date.now(), weeksKey: ids.studium + '/' + ids.obdobi });
      }
      const src = getSource();
      const key = sourceKey(src);
      if (key && (stale(cal.ttAt) || cal.ttKey !== key || cal.ttLang !== lang())) {
        const tt = await loadSourceTimetable(src);
        if (tt) {
          setCal({ tt, ttAt: Date.now(), ttKey: key, ttLang: lang(), ttError: false });
          if (src && tt.title) store.set('ttSource', Object.assign({}, src, { title: tt.title }));
        }
      }
      return true;
    })()
      .catch(e => {
        console.warn('[UIS+] semester data refresh failed:', e);
        setCal({ ttError: true });
        return false;
      })
      .finally(() => {
        refreshing = null;
        refreshBar();
      });
    return refreshing;
  }

  /* Your changes to the timetable: hidden classes, edited classes and classes you added. */
  const getEdits = () => Object.assign({ hidden: {}, patch: {}, custom: [] }, store.get('ttEdits', {}));
  const setEdits = edits => {
    store.set('ttEdits', edits);
    refreshBar();
  };
  // Keyed by UIS's course id (not the name), so edits survive switching UIS between Slovak and English.
  const lessonKey = l => [l.day, l.start, l.cid || norm(l.title), norm(l.room)].join('|');
  const legacyKey = l => [l.day, l.start, norm(l.title), norm(l.room)].join('|');

  // The timetable as shown: UIS classes with your edits applied, plus your own classes.
  function effectiveLessons(includeHidden) {
    const { tt } = getCal();
    const edits = getEdits();
    const out = [];
    for (const base of (tt && getCal().ttKey === sourceKey(getSource()) ? tt.lessons : [])) {
      const key = lessonKey(base);
      const old = legacyKey(base);
      const patch = edits.patch[key] || edits.patch[old];
      const l = Object.assign({}, base, patch || null, { key, oldKey: old, edited: !!patch, hidden: !!(edits.hidden[key] || edits.hidden[old]) });
      if (includeHidden || !l.hidden) out.push(l);
    }
    for (const c of edits.custom) out.push(Object.assign({ off: [], teacher: '', room: '' }, c, { key: 'c:' + c.id, custom: true, hidden: false }));
    return out;
  }

  function weekOf(date) {
    const weeks = getCal().weeks;
    if (!weeks) return null;
    const iso = isoDate(date);
    return weeks.find(w => iso >= w.from && iso <= w.to) || null;
  }

  function semesterStatus(date) {
    const weeks = getCal().weeks;
    if (!weeks || !weeks.length) return null;
    const iso = isoDate(date);
    const wk = weekOf(date);
    if (wk) return { kind: 'week', n: wk.n, odd: wk.odd };
    if (iso < weeks[0].from) {
      const days = Math.round((new Date(weeks[0].from + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 864e5);
      return days <= 60 ? { kind: 'before', days } : null;
    }
    const last = new Date(weeks[weeks.length - 1].to + 'T00:00:00');
    return date - last < 7 * 7 * 864e5 ? { kind: 'exams' } : null;
  }

  // Classes that actually take place on a date: teaching weeks only, odd/even weeks and days off respected.
  function lessonsOn(date, all = effectiveLessons()) {
    const { tt, weeks } = getCal();
    const iso = isoDate(date);
    const wk = weekOf(date);
    if (weeks && !wk) return []; // outside teaching weeks (holidays, exam period)
    const inValidity = !tt || ((!tt.from || iso >= tt.from) && (!tt.to || iso <= tt.to));
    return all
      .filter(l => (l.custom || inValidity) && l.day === date.getDay() && !(l.off || []).includes(iso) && (!l.parity || !wk || (l.parity === 'odd') === wk.odd))
      .sort((a, b) => a.start - b.start);
  }

  // Ongoing or next lesson today; otherwise the first lesson of the next teaching day within a week.
  function upcoming(now, all = effectiveLessons()) {
    const m = nowMin(now);
    const today = lessonsOn(now, all);
    const current = today.find(l => l.start <= m && m < l.end);
    if (current) return { lesson: current, state: 'now', date: now };
    const next = today.find(l => l.start > m);
    if (next) return { lesson: next, state: 'next', date: now };
    for (let i = 1; i <= 7; i++) {
      const d = addDays(now, i);
      const list = lessonsOn(d, all);
      if (list.length) return { lesson: list[0], state: 'later', date: d, offset: i };
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Learning links, recent pages and pins                               *
   * ------------------------------------------------------------------ */
  const MAX_LINKS = 1500;

  function harvestLinks() {
    const index = store.get('links', {});
    const now = Date.now();
    const context = pageTitle();
    let seen = 0;
    for (const a of document.querySelectorAll('a[href]')) {
      if (a.closest('.aisx-ui')) continue;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(href)) continue;
      let url;
      try {
        url = new URL(href, location.href);
      } catch (e) {
        continue;
      }
      if (url.origin !== location.origin || !url.pathname.startsWith('/auth/')) continue;
      const img = a.querySelector('img[alt]');
      const text = clean(a.textContent) || clean(a.title) || clean(a.getAttribute('aria-label')) || clean(img && img.alt);
      if (text.length < 2 || text.length > 90 || /^[\d\s.,–-]+$/.test(text)) continue;
      if (LOGOUT_RE.test(url.href) || LOGOUT_RE.test(text) || /herna\//.test(url.pathname)) continue;
      url.hash = '';
      const entry = index[url.href] || (index[url.href] = { s: 0 });
      entry.t = text;
      entry.c = context;
      entry.l = now;
      entry.s = Math.min(9999, (entry.s || 0) + 1);
      if (++seen > 1000) break;
    }
    const keys = Object.keys(index);
    if (keys.length > MAX_LINKS) {
      keys.sort((a, b) => index[b].l - index[a].l);
      for (const k of keys.slice(MAX_LINKS)) delete index[k];
    }
    store.set('links', index);
  }

  function rememberVisit() {
    if (LOGOUT_RE.test(location.href) || !loggedIn()) return;
    const here = urlKey(location.href);
    const recent = store.get('recent', []).filter(r => r.u !== here);
    recent.unshift({ u: here, t: pageTitle(), l: Date.now() });
    store.set('recent', recent.slice(0, 25));
  }

  const getPins = () => store.get('pins', []);
  const setPins = pins => {
    store.set('pins', pins);
    refreshBar();
  };
  const isPinned = () => getPins().some(p => p.u === urlKey(location.href));
  function togglePin() {
    const here = urlKey(location.href);
    const pins = getPins();
    if (pins.some(p => p.u === here)) {
      setPins(pins.filter(p => p.u !== here));
      toast(t('unpinned'));
    } else {
      pins.push({ u: here, t: pageTitle() });
      setPins(pins);
      toast(t('pinned'));
    }
  }

  // A timetable chosen by criteria cannot be linked to directly, so it links to the UIS Timetables page.
  const timetableUrl = () => {
    const ids = getIds();
    return ids.rozvrh && !getSource() ? `/auth/katalog/rozvrhy_view.pl?zobraz=1;format=html;rozvrh_student=${ids.rozvrh}` : '/auth/katalog/rozvrhy_view.pl?_m=117';
  };

  /* ------------------------------------------------------------------ *
   * Header bar (replaces the 170px STU header)                           *
   * ------------------------------------------------------------------ */
  // Everything the original header shows, read once so the bar can present it compactly.
  function readHeader() {
    const hl = document.querySelector('#hlavicka');
    if (!hl) return null;
    const bg = getComputedStyle(hl.querySelector('#ie1, #ie2') || hl).backgroundImage;
    const logo = (/url\(["']?([^"')]+)["']?\)/.exec(bg) || [])[1] || null;
    const counters = [];
    for (const a of hl.querySelectorAll('#ema a')) {
      const href = a.getAttribute('href');
      let item = counters.find(c => c.href === href);
      if (!item) counters.push((item = { href, count: null, label: '' }));
      const txt = clean(a.textContent);
      if (/^\d+$/.test(txt)) item.count = +txt;
      else item.label = txt;
    }
    const logout = hl.querySelector('#ikonky a[href*="logout"], a[href*="logout.pl"]');
    const name = clean((hl.querySelector('#log') || {}).textContent || '').replace(/^[^:]*:\s*/, '');
    const langs = Array.from(hl.querySelectorAll('#vlajky a')).map(a => ({ href: a.href, code: ((/lang=(\w+)/.exec(a.href) || [])[1] || '').toUpperCase(), title: (a.querySelector('img') || a).title }));
    const svatek = hl.querySelector('#svatek');
    let nameday = '';
    if (svatek) {
      const spans = svatek.querySelectorAll('span');
      const after = spans.length > 1 ? spans[1].nextSibling : null;
      nameday = clean(after ? after.textContent : '');
    }
    // The location row (breadcrumb) moves into the UIS+ second row; UIS's own copy is hidden while that row is shown.
    const nav = document.querySelector('nav[aria-label="breadcrumb"]');
    const crumbs = nav ? Array.from(nav.querySelectorAll('ol.breadcrumb > li')).map(li => {
      const a = li.querySelector('a[href]');
      const glyph = li.querySelector('[aria-label], [title]');
      const text = clean(li.textContent);
      return {
        href: a ? a.href : null,
        text: text || clean(glyph && (glyph.getAttribute('aria-label') || glyph.getAttribute('title'))) || t('home'),
        home: !!a && !text,
        current: li.classList.contains('active'),
      };
    }) : [];
    const help = nav && nav.querySelector('.helpinbreadcrumbs a');
    return { logo, counters, logout: logout && logout.getAttribute('href'), name, langs, nameday, crumbs, help };
  }

  function buildBar() {
    if (!settings.topBar || bar || !document.body) return;
    header = readHeader();
    if (!header) return;
    bar = h('div', { class: 'aisx-ui aisx-bar aisx-keepdark', role: 'banner' });
    document.body.prepend(bar);
    ROOT.classList.add('aisx-hasbar');
    refreshBar();
  }

  const COUNTER_ICON = href => (/posta/.test(href) ? ['mail', 'mail'] : /dok_server/.test(href) ? ['file', 'docs'] : ['check', 'tasks']);

  function refreshBar() {
    if (subBar) {
      subBar.remove();
      subBar = null;
    }
    if (!bar || !header) {
      ROOT && ROOT.style.setProperty('--aisx-sticky-top', '0px');
      return;
    }
    const isIn = loggedIn();
    const pinned = isPinned();
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const initials = header.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const unread = header.counters.reduce((sum, c) => sum + (c.count || 0), 0);
    const otherLang = header.langs.find(l => l.code && l.code !== 'CZ') || header.langs[0];
    const crumbs = header.crumbs.length ? header.crumbs : [{ href: '/auth/', text: t('home'), home: true }];
    // replaceChildren() would print a null as the text "null", so absent parts are filtered out.
    const parts = [
      h('a', { class: 'aisx-logo', href: '/auth/', title: t('home') }, header.logo ? h('img', { src: header.logo, alt: 'STU' }) : h('b', null, 'STU')),
      h('span', { class: 'aisx-sep' }),
      isIn ? h('nav', { class: 'aisx-crumbs', 'aria-label': t('location') }, crumbs.map((c, i) => [
        i ? h('span', { class: 'aisx-crumb-sep' }, '›') : null,
        c.home
          ? h('a', { class: 'aisx-home', href: c.href, title: c.text, 'aria-label': c.text }, icon('home', 17))
          : c.href && !c.current ? h('a', { href: c.href, title: c.text }, c.text) : h('span', { class: 'is-current', title: c.text }, c.text),
      ])) : null,
      h('div', { class: 'aisx-spacer' }),
      isIn ? h('button', { class: 'aisx-searchbtn', type: 'button', onclick: openPalette, title: t('search') },
        icon('search', 15), h('span', null, t('search')), h('kbd', { class: 'aisx-kbd' }, isMac ? '⌘K' : 'Ctrl K')) : null,
      h('div', { class: 'aisx-tools' },
        isIn && settings.today ? (() => {
          const off = shownView() === 'off';
          const label = off ? t('ttShowHere') : t('ttHideHere');
          return h('button', { class: 'aisx-bbtn' + (off ? '' : ' is-active'), type: 'button', title: label, 'aria-label': label, 'aria-pressed': String(!off), onclick: () => setView(off ? visibleView() : 'off') }, icon('calendar', 18));
        })() : null,
        isIn ? h('button', { class: 'aisx-bbtn' + (pinned ? ' is-on' : ''), type: 'button', title: pinned ? t('unpin') : t('pin'), 'aria-label': pinned ? t('unpin') : t('pin'), onclick: togglePin }, icon('star', 18, pinned)) : null,
        // Signed in, dark mode, settings, help and language live in the profile menu; without a profile they stay here.
        header.name ? null : [
          h('button', { class: 'aisx-bbtn', type: 'button', title: t('themeToggle'), 'aria-label': t('themeToggle'), onclick: toggleDark }, icon(isDark() ? 'sun' : 'moon', 18)),
          h('button', { class: 'aisx-bbtn', type: 'button', title: t('settings'), 'aria-label': t('settings'), onclick: openSettings }, icon('sliders', 18)),
          otherLang ? h('a', { class: 'aisx-bbtn aisx-lang', href: otherLang.href, title: otherLang.title }, otherLang.code) : null,
        ]),
      header.name
        ? h('button', { class: 'aisx-profile', type: 'button', title: t('account'), 'aria-haspopup': 'menu', 'aria-expanded': String(menuOwner === '.aisx-profile'), onclick: e => toggleProfileMenu(e.currentTarget) },
            h('span', { class: 'aisx-avatar' }, initials, unread ? h('span', { class: 'aisx-badge' }, String(unread)) : null),
            h('span', { class: 'aisx-pname' }, header.name),
            icon('down', 15))
        : header.logout ? h('a', { class: 'aisx-bbtn', href: header.logout, title: t('logout'), 'aria-label': t('logout') }, icon('power', 18)) : null,
    ];
    bar.replaceChildren(...parts.filter(Boolean));
    if (isIn) ROOT.classList.add('aisx-hascrumbs');

    // Second row: pinned favourites only.
    const pins = isIn ? getPins() : [];
    if (pins.length) {
      const here = urlKey(location.href);
      subBar = h('div', { class: 'aisx-ui aisx-sub' }, h('div', { class: 'aisx-sub-in' },
        h('div', { class: 'aisx-pins' }, pins.map(p => h('a', { class: p.u === here ? 'is-current' : '', href: p.u, title: p.t }, icon('star', 13, true), p.t)))));
      bar.after(subBar);
    }
    ROOT.style.setProperty('--aisx-sticky-top', settings.enabled ? bar.offsetHeight + 'px' : '0px');
    renderTimetableSection();
  }

  // Your UIS login (e.g. xnovakj) for the profile menu. UIS shows it only on the Accounts administration
  // page, so it is read from there once and remembered (per signed-in name, in case the browser is shared).
  const savedLogin = () => {
    const saved = store.get('login', null);
    return saved && header && saved.name === header.name ? saved.login : '';
  };

  async function loadLogin() {
    if (!loggedIn() || !header || !header.name || savedLogin()) return;
    try {
      const doc = await fetchDoc('/auth/ca/ucet.pl?lang=sk');
      const row = Array.from(doc.querySelectorAll('tr')).find(r => r.cells.length >= 2 && /\(login\)/i.test(r.cells[0].textContent));
      const login = row && clean(row.cells[1].textContent);
      if (login && /^[A-Za-z0-9._-]{2,40}$/.test(login)) store.set('login', { name: header.name, login });
    } catch (e) {
      console.warn('[UIS+] login name not found:', e);
    }
  }

  // Small drop-down menus (your profile, the timetable's "⋯"); one open at a time.
  let menuOwner = null;
  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    const owner = menuOwner && document.querySelector(menuOwner);
    if (owner) owner.setAttribute('aria-expanded', 'false');
    menuOwner = null;
  }

  function openMenu(btn, ownerSelector, ...children) {
    if (menu && menuOwner === ownerSelector) return closeMenu();
    closeMenu();
    menu = h('div', { class: 'aisx-ui aisx-menu', role: 'menu' }, children);
    menuOwner = ownerSelector;
    document.body.append(menu);
    const r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + 6 + 'px';
    menu.style.left = Math.max(12, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 12)) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    // Bars are redrawn while a menu is open (the theme switch does that), so the owner is found by selector.
    const onDown = e => {
      if (!menu) return;
      if (menu.contains(e.target) || (e.target.closest && e.target.closest(ownerSelector))) document.addEventListener('mousedown', onDown, { once: true });
      else closeMenu();
    };
    setTimeout(() => document.addEventListener('mousedown', onDown, { once: true }), 0);
  }

  const menuItem = (ic, label, onclick) => h('button', { class: 'aisx-mi', type: 'button', role: 'menuitem', onclick: () => { closeMenu(); onclick(); } }, icon(ic, 17), h('span', null, label));

  // Your name opens: messages, documents, tasks · dark mode, UIS+ settings, help, language · log out.
  function toggleProfileMenu(btn) {
    const dark = h('button', { class: 'aisx-mi', type: 'button', role: 'menuitemcheckbox', 'aria-checked': String(isDark()), onclick: () => {
      toggleDark();
      dark.setAttribute('aria-checked', String(isDark()));
    } }, icon('moon', 17), h('span', null, t('darkMode')), h('span', { class: 'aisx-switch' }));
    const otherLang = header.langs.find(l => l.code && l.code !== 'CZ') || header.langs[0];
    openMenu(btn, '.aisx-profile',
      h('div', { class: 'aisx-menu-head' },
        h('b', null, header.name),
        h('small', null, savedLogin() || t('loggedInAs')),
        header.nameday ? h('small', { class: 'aisx-nd' }, t('nameday', header.nameday.split(/[,(]/)[0].trim())) : null),
      header.counters.map(c => {
        const [ic, key] = COUNTER_ICON(c.href);
        return h('a', { href: c.href, role: 'menuitem' }, icon(ic, 17), h('span', null, t(key)), h('span', { class: 'aisx-count' + (c.count ? ' is-new' : '') }, String(c.count ?? 0)));
      }),
      h('hr'),
      dark,
      menuItem('sliders', t('settings'), openSettings),
      header.help ? menuItem('help', t('help'), () => header.help.click()) : null,
      otherLang ? h('a', { href: otherLang.href, role: 'menuitem' }, icon('globe', 17), h('span', null, otherLang.title || otherLang.code)) : null,
      header.logout ? [h('hr'), h('a', { class: 'aisx-danger', href: header.logout, role: 'menuitem' }, icon('power', 17), h('span', null, t('logout')))] : null);
  }

  function toggleDark() {
    settings.theme = isDark() ? 'light' : 'dark';
    saveSettings();
    applyTheme();
  }

  function setEnabled(on) {
    settings.enabled = on;
    saveSettings();
    applyTheme();
  }

  /* ------------------------------------------------------------------ *
   * Timetable section under the header: the week as a timeline           *
   * ------------------------------------------------------------------ */
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const kindName = k => (k === 'pred' ? t('lecture') : k === 'cvic' ? t('seminar') : t('other'));
  const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7));
  // On weekends the section starts with the coming week.
  const shownMonday = now => addDays(startOfWeek(now.getDay() % 6 === 0 ? addDays(now, 2) : now), 7 * weekOffset);

  function weekHeading(monday) {
    const wk = weekOf(monday) || weekOf(addDays(monday, 4));
    if (wk) return t('week', wk.n, wk.odd);
    const weeks = getCal().weeks || [];
    if (!weeks.length) return weekOffset === 0 ? t('thisWeek') : '';
    if (isoDate(addDays(monday, 6)) < weeks[0].from) return t('beforeSemester');
    const sinceEnd = monday - new Date(weeks[weeks.length - 1].to + 'T00:00:00');
    return sinceEnd > 0 && sinceEnd < 7 * 7 * 864e5 ? t('exams') : t('outsideTeaching');
  }

  function summaryFor(now, all) {
    const info = upcoming(now, all);
    if (!info) return h('div', { class: 'aisx-ts-sum' }, h('span', null, h('i', null, t('noClassesWeek'))));
    const { lesson: l, state, date, offset } = info;
    const badge = state === 'now' ? t('now') : state === 'next' ? t('next') : offset === 1 ? t('tomorrow') : cap(weekdayName(date));
    const tail = [l.room, state === 'now' ? t('until', fmtMin(l.end)) : null].filter(Boolean).join(' · ');
    return h('div', { class: 'aisx-ts-sum' },
      h('em', { class: state === 'now' ? null : 'is-soft' }, badge),
      h('span', null, state === 'now' ? null : fmtMin(l.start) + ' · ', h('b', null, l.title), tail ? h('i', null, ' · ' + tail) : null));
  }

  // Classes laid out on a time axis, one row per day. The week view marks "now" with a vertical line;
  // the one-day strip (collapsed section) gets a left-to-right line that fills up as the day goes on.
  function timeline(days, now, strip) {
    const todayIso = isoDate(now);
    const m = nowMin(now);
    const flat = days.flatMap(d => d.lessons);
    if (!flat.length) return h('div', { class: 'aisx-ts-msg' }, t('noTeachingWeek'));
    const from = Math.min(8 * 60, Math.floor(Math.min(...flat.map(l => l.start)) / 60) * 60);
    const to = Math.max(from + 9 * 60, Math.ceil(Math.max(...flat.map(l => l.end)) / 60) * 60);
    const hours = (to - from) / 60;
    const pct = v => ((v - from) / (to - from)) * 100;
    const axis = h('div', { class: 'aisx-ts-axis' }, Array.from({ length: hours }, (_, i) => h('span', { style: `left:${(i / hours) * 100}%` }, fmtMin(from + i * 60))));
    const rows = days.map(({ date, lessons, label }) => {
      const iso = isoDate(date);
      const isToday = iso === todayIso;
      const next = isToday ? lessons.find(l => l.start > m) : null;
      // Overlapping classes (for example parallel groups) get their own lane.
      const lanes = [];
      const placed = lessons.map(l => {
        let lane = lanes.findIndex(end => end <= l.start);
        if (lane < 0) lane = lanes.push(0) - 1;
        lanes[lane] = l.end;
        return { l, lane };
      });
      const progress = Math.max(0, Math.min(1, (m - from) / (to - from))) * 100;
      const line = !strip ? null : isToday
        ? h('div', { class: 'aisx-ts-line' }, h('i', { style: `width:${progress}%` }), h('b', { style: `left:${progress}%` }), h('em', { style: `left:${progress}%` }, fmtMin(m)))
        : h('div', { class: 'aisx-ts-line' });
      const track = h('div', { class: 'aisx-ts-track', style: `--aisx-hours:${hours};height:${Math.max(1, lanes.length) * 54 + 4 + (strip ? 26 : 0)}px` },
        placed.map(({ l, lane }) => {
          const isNow = isToday && l.start <= m && m < l.end;
          const past = iso < todayIso || (isToday && l.end <= m);
          const badge = isNow ? h('em', null, t('now')) : l === next ? h('em', { class: 'is-soft' }, t('next')) : null;
          return h('button', {
            type: 'button',
            class: `aisx-ts-l k-${l.kind}` + (past ? ' is-past' : '') + (isNow ? ' is-now' : ''),
            style: `left:calc(${pct(l.start)}% + 2px);width:calc(${pct(l.end) - pct(l.start)}% - 4px);top:${lane * 54 + 4}px`,
            title: [l.title, `${fmtMin(l.start)}–${fmtMin(l.end)}`, kindName(l.kind), l.room, l.teacher].filter(Boolean).join('\n'),
            onclick: () => openTimetableEditor(l.key),
          }, h('b', null, badge, l.title), h('span', null, [`${fmtMin(l.start)}–${fmtMin(l.end)}`, l.room].filter(Boolean).join(' · ')));
        }),
        line);
      return h('div', { class: 'aisx-ts-row' + (isToday && !strip ? ' is-today' : '') },
        h('div', { class: 'aisx-ts-day' }, label || cap(weekdayName(date, 'short')), h('small', null, shortDate(date))), track);
    });
    const grid = h('div', { class: 'aisx-ts-grid' + (strip ? ' aisx-ts-strip' : '') }, axis, rows);
    if (!strip && days.some(d => isoDate(d.date) === todayIso) && m >= from && m <= to) {
      grid.append(h('div', { class: 'aisx-ts-now', style: `left:calc(var(--aisx-daycol) + (100% - var(--aisx-daycol)) * ${(m - from) / (to - from)})` }, h('span', null, fmtMin(m))));
    }
    return grid;
  }

  function weekGrid(monday, now, all) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map(date => ({ date, lessons: lessonsOn(date, all) }));
    return timeline(days.filter((d, i) => i < 5 || d.lessons.length), now, false);
  }

  // Collapsed section: today's whole day, or the next day with classes when today has none.
  function dayStrip(now, all) {
    let date = now;
    let lessons = lessonsOn(now, all);
    let label = t('today');
    for (let i = 1; i <= 7 && !lessons.length; i++) {
      date = addDays(now, i);
      lessons = lessonsOn(date, all);
      label = i === 1 ? t('tomorrow') : cap(weekdayName(date, 'short'));
    }
    if (!lessons.length) return h('div', { class: 'aisx-ts-msg' }, t('noClassesWeek'));
    return timeline([{ date, lessons, label }], now, true);
  }

  // How much timetable to show where. The home page (Personal administration), the My College pages
  // and e-learning get the full section (your Week or Day view); every other part of UIS gets the
  // one-line Mini bar. Whatever you pick in a part of UIS is remembered for that part.
  const STUDY_AREAS = new Set(['', 'student', 'studijni', 'ca', 'prihlaska', 'elis', 'eknihovna']);
  const uisArea = () => {
    const seg = (/^\/auth\/([^/?;]+)/.exec(location.pathname) || [])[1] || '';
    return seg === 'index.pl' ? '' : seg;
  };
  const fullView = () => store.get('ttFull', store.get('ttCollapsed', false) ? 'day' : 'week');
  const areaMode = () => store.get('ttModes', {})[uisArea()] || (STUDY_AREAS.has(uisArea()) ? 'full' : 'mini');
  const shownView = () => (areaMode() === 'full' ? fullView() : areaMode()); // week | day | mini | off
  const visibleView = () => (STUDY_AREAS.has(uisArea()) ? fullView() : 'mini');

  function setView(view) {
    const modes = store.get('ttModes', {});
    if (view === 'week' || view === 'day') {
      store.set('ttFull', view);
      modes[uisArea()] = 'full';
    } else modes[uisArea()] = view;
    store.set('ttModes', modes);
    if (view !== 'week') weekOffset = 0;
    refreshBar();
    if (view === 'off') toast(t('ttHiddenHere'));
  }

  function renderTimetableSection() {
    const anchor = subBar || bar;
    if (ttSection) {
      ttSection.remove();
      ttSection = null;
    }
    if (!anchor || !settings.today || !loggedIn()) return;
    const view = shownView();
    if (view === 'off') return;
    if (view !== 'week') weekOffset = 0;
    const cal = getCal();
    const now = new Date();
    const monday = shownMonday(now);
    const all = effectiveLessons();
    const hasData = !!(cal.tt && cal.ttKey === sourceKey(getSource())) || all.length > 0;
    const seg = h('div', { class: 'aisx-seg', role: 'group', 'aria-label': t('ttView') },
      [['week', t('modeWeek')], ['day', t('modeDay')], ['mini', t('modeMini')]].map(([v, label]) =>
        h('button', { type: 'button', class: v === view ? 'is-on' : null, 'aria-pressed': String(v === view), onclick: () => setView(v) }, label)));
    const more = h('button', { class: 'aisx-ts-nav aisx-ts-more', type: 'button', title: t('more'), 'aria-label': t('more'), 'aria-haspopup': 'menu', 'aria-expanded': String(menuOwner === '.aisx-ts-more'),
      onclick: e => openMenu(e.currentTarget, '.aisx-ts-more',
        menuItem('edit', t('edTitle'), () => openTimetableEditor()),
        h('a', { href: timetableUrl(), role: 'menuitem' }, icon('calendar', 17), h('span', null, t('fullTimetable'))),
        h('hr'),
        menuItem('x', t('ttHideHere'), () => setView('off'))) }, icon('more', 16, true));

    if (view === 'mini') {
      const today = hasData ? lessonsOn(now, all) : [];
      let line = null;
      if (today.length) {
        // A thin line along the bottom fills up from the first to the last class of the day.
        const from = today[0].start;
        const to = Math.max(...today.map(l => l.end));
        line = h('div', { class: 'aisx-ts-miniline' }, h('i', { style: `width:${Math.max(0, Math.min(1, (nowMin(now) - from) / (to - from))) * 100}%` }));
      }
      ttSection = h('section', { class: 'aisx-ui aisx-ts is-mini', 'aria-label': t('fullTimetable') },
        h('div', { class: 'aisx-ts-in' }, h('div', { class: 'aisx-ts-head' },
          h('div', { class: 'aisx-ts-wk' }, icon('calendar', 15), h('b', null, weekHeading(monday))),
          hasData ? summaryFor(now, all) : h('div', { class: 'aisx-ts-sum' }, h('span', null, h('i', null, cal.ttError ? t('ttFailed') : t('ttLoading')))),
          h('div', { class: 'aisx-ts-actions' }, seg, more))),
        line);
      anchor.after(ttSection);
      return;
    }

    const day = view === 'day';
    const nav = (dir, label, ic) => h('button', { class: 'aisx-ts-nav', type: 'button', title: label, 'aria-label': label, onclick: () => { weekOffset += dir; renderTimetableSection(); } }, icon(ic, 16));
    const head = h('div', { class: 'aisx-ts-head' },
      day
        ? h('div', { class: 'aisx-ts-week' },
            h('div', { class: 'aisx-ts-wk' }, h('b', null, weekHeading(monday)), h('small', null, `${cap(weekdayName(now))} ${shortDate(now)}`)))
        : h('div', { class: 'aisx-ts-week' },
            nav(-1, t('prevWeek'), 'left'),
            h('div', { class: 'aisx-ts-wk' }, h('b', null, weekHeading(monday)), h('small', null, `${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`)),
            nav(1, t('nextWeek'), 'right'),
            weekOffset ? h('button', { class: 'aisx-btn', type: 'button', onclick: () => { weekOffset = 0; renderTimetableSection(); } }, t('thisWeek')) : null),
      weekOffset === 0 && hasData ? summaryFor(now, all) : h('div', { class: 'aisx-ts-sum' }),
      h('div', { class: 'aisx-ts-actions' }, seg, more));
    const body = h('div', { class: 'aisx-ts-body' });
    if (hasData) body.append(day ? dayStrip(now, all) : weekGrid(monday, now, all));
    else if (cal.ttError) body.append(h('div', { class: 'aisx-ts-msg' }, t('ttFailed'), h('button', { class: 'aisx-btn', type: 'button', onclick: () => refreshData(true) }, t('retry'))));
    else body.append(h('div', { class: 'aisx-ts-msg' }, t('ttLoading')));
    ttSection = h('section', { class: 'aisx-ui aisx-ts', 'aria-label': t('fullTimetable') }, h('div', { class: 'aisx-ts-in' }, head, body));
    anchor.after(ttSection);
  }

  /* ------------------------------------------------------------------ *
   * UIS help panel ("Nápověda"): opens below the bar, labels translated  *
   * ------------------------------------------------------------------ */
  // UIS only has help texts in Czech (sk/en are not on the server), and its panel labels are hard-coded Czech.
  const HELP_LABELS = {
    'Nápověda': ['Nápoveda', 'Help'],
    'Minimalizovat okno': ['Minimalizovať okno', 'Minimise window'],
    'Nápověda je nyní kontextová, chci zafixovat zobrazené téma': ['Nápoveda sleduje stránku – zafixovať zobrazenú tému', 'Help follows the page – keep this topic'],
    'Nápověda je zafixovaná, chci začít kontextově sledovat zobrazené téma': ['Téma je zafixované – znova sledovať stránku', 'Topic is kept – follow the page again'],
    'Odepnout nápovědu ze stránky': ['Odopnúť nápovedu zo stránky', 'Undock help from the page'],
    'Připnout nápovědu do stránky': ['Pripnúť nápovedu do stránky', 'Dock help into the page'],
    'Vrátit okno do původní pozice': ['Vrátiť okno do pôvodnej polohy', 'Reset window position'],
    'Zavřít nápovědu': ['Zavrieť nápovedu', 'Close help'],
    'Zobrazit v samostatné aplikaci': ['Zobraziť v samostatnej aplikácii', 'Open as a separate page'],
    'Zpět na předchozí téma': ['Späť na predchádzajúcu tému', 'Back to the previous topic'],
  };

  function enhanceHelp() {
    const label = cz => HELP_LABELS[cz] && HELP_LABELS[cz][lang() === 'en' ? 1 : 0];
    // Every change below is made at most once, so the observer settles instead of looping.
    const fix = reader => {
      for (const el of [reader, ...reader.querySelectorAll('[title]')]) {
        const text = label(el.getAttribute('title'));
        if (text) el.setAttribute('title', text);
      }
      const title = reader.querySelector('#uis-context-help-title');
      if (title && label(clean(title.textContent))) title.textContent = label(clean(title.textContent));
      // The note sits at the top of the help text, so it comes back when another topic is loaded.
      const doc = reader.querySelector('.documentation');
      if (doc && !doc.querySelector('.aisx-help-note')) doc.prepend(h('p', { class: 'aisx-ui aisx-help-note' }, t('helpOnlyCzech')));
      // UIS opens the panel 40px from the top, under the UIS+ bar; keep it below the bar.
      if (bar && settings.enabled && getComputedStyle(reader).position === 'fixed') {
        const minTop = Math.round(bar.getBoundingClientRect().bottom) + 12;
        if (reader.getBoundingClientRect().top < minTop) {
          reader.style.top = minTop + 'px';
          if (reader.offsetHeight > innerHeight - minTop - 16) reader.style.height = innerHeight - minTop - 16 + 'px';
        }
      }
    };
    let watched = null;
    const watch = () => {
      const reader = document.getElementById('uis-context-help-reader');
      if (!reader || reader === watched) return;
      watched = reader;
      fix(reader);
      new MutationObserver(() => fix(reader)).observe(reader, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'title'] });
    };
    new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });
    watch();
  }

  // The UIS statistics box at the bottom of the home page folds into a small ∑ that opens on hover.
  function foldOperInfo() {
    document.querySelectorAll('.operinfo').forEach(el => {
      el.classList.add('aisx-egg');
      el.tabIndex = 0;
      el.setAttribute('aria-label', t('opsTitle'));
    });
  }

  /* ------------------------------------------------------------------ *
   * Timetable editor: choose the source like on the UIS Timetables page, *
   * then hide, change or add classes                                     *
   * ------------------------------------------------------------------ */
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const dayName = d => cap(weekdayName(addDays(startOfWeek(new Date()), (d + 6) % 7)));
  const toMin = v => {
    const m = /^(\d{1,2}):(\d{2})/.exec(v || '');
    return m ? +m[1] * 60 + +m[2] : NaN;
  };
  const toTime = v => `${pad2(Math.floor(v / 60))}:${pad2(v % 60)}`;
  const parityName = p => (p === 'odd' ? t('odd') : p === 'even' ? t('even') : t('every'));

  function openTimetableEditor(focusKey) {
    const sourceBox = h('div');
    const listBox = h('div');
    let formEl = null;

    const panel = h('div', { class: 'aisx-panel aisx-wide', role: 'dialog', 'aria-label': t('edTitle') },
      h('div', { class: 'aisx-set-head' },
        h('div', null, h('b', null, t('edTitle'))),
        h('button', { class: 'aisx-icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onclick: closeOverlay }, icon('x', 16))),
      h('div', { class: 'aisx-set-body' },
        h('h5', null, t('edSource')), sourceBox,
        h('h5', null, t('edClasses')), h('p', { class: 'aisx-help' }, t('edClassesHelp')), listBox,
        h('div', { class: 'aisx-ed-foot' },
          h('button', { class: 'aisx-btn aisx-primary', type: 'button', onclick: () => openForm(null, null) }, icon('plus', 14), t('edAdd')),
          h('button', { class: 'aisx-btn aisx-danger', type: 'button', onclick: () => {
            if (!confirm(t('edResetConfirm'))) return;
            setEdits({ hidden: {}, patch: {}, custom: [] });
            renderList();
          } }, t('edResetAll')))));
    openOverlay(panel);

    function renderSource() {
      const src = getSource();
      const crit = h('div');
      const radio = (value, label) => h('label', { class: 'aisx-ed-radio' },
        h('input', { type: 'radio', name: 'aisx-src', value, checked: (value === 'other') === !!src, onchange: () => (value === 'personal' ? usePersonal() : loadCriteria(crit)) }),
        label);
      sourceBox.replaceChildren(
        radio('personal', t('edPersonal')),
        radio('other', t('edOther')),
        h('p', { class: 'aisx-ed-current' }, t('edCurrent', src ? src.title : t('edPersonalName')),
          src ? [' · ', h('a', { href: '#', onclick: e => { e.preventDefault(); loadCriteria(crit); } }, t('edit'))] : null),
        crit);
    }

    async function usePersonal() {
      store.set('ttSource', null);
      renderSource();
      renderList();
      refreshBar(); // shows "loading" instead of the previous timetable while UIS answers
      const ok = await refreshData(true);
      toast(ok && getCal().tt ? t('edSourceSaved', t('edPersonalName')) : t('refreshFail'));
      renderList();
    }

    // The same criteria form as on the UIS Timetables page, read live from UIS.
    async function loadCriteria(box) {
      const src = getSource();
      box.replaceChildren(h('p', { class: 'aisx-ed-msg' }, t('edLoading')));
      let form = null;
      try {
        const doc = await fetchDoc(TT_VIEW);
        form = Array.from(doc.querySelectorAll('form')).find(f => f.querySelector('select[name="program"], select[name="predmet"], select[name="mistnost"]'));
      } catch (e) {
        console.warn('[UIS+] timetable criteria failed:', e);
      }
      if (!form) {
        box.replaceChildren(h('p', { class: 'aisx-ed-msg is-err' }, t('edCriteriaFailed')));
        return;
      }
      const hidden = Array.from(form.querySelectorAll('input[type="hidden"]')).map(i => [i.name, i.value]);
      const selects = Array.from(form.querySelectorAll('select')).filter(s => s.name && s.name !== 'format').map(s => {
        const row = s.closest('tr');
        const label = clean(row && row.cells[0] ? row.cells[0].textContent : s.name).replace(/\s*\*$/, '');
        const saved = src && src.params[s.name];
        const sel = h('select', { name: s.name }, Array.from(s.options).map(o => h('option', { value: o.value, selected: saved != null ? saved === o.value : o.selected }, clean(o.textContent))));
        return { name: s.name, label, sel };
      });
      const show = form.querySelector('[name="zobraz"]');
      const msg = h('span', { class: 'aisx-ed-msg' });
      const apply = h('button', { class: 'aisx-btn aisx-primary', type: 'button', onclick: async () => {
        const params = Object.fromEntries(hidden);
        let chosen = 0;
        for (const s of selects) {
          params[s.name] = s.sel.value;
          if (s.sel.value && s.sel.value !== '0') chosen++;
        }
        if (!chosen) {
          msg.className = 'aisx-ed-msg is-err';
          msg.textContent = t('edNoCriteria');
          return;
        }
        params.format = 'html';
        params.zobraz = (show && show.value) || '1';
        msg.className = 'aisx-ed-msg';
        msg.textContent = t('edLoading');
        apply.disabled = true;
        try {
          const next = { title: t('edOther'), params };
          const tt = await loadSourceTimetable(next);
          if (!tt) throw new Error('no classes');
          next.title = tt.title || next.title;
          store.set('ttSource', next);
          setCal({ tt, ttAt: Date.now(), ttKey: sourceKey(next), ttLang: lang(), ttError: false });
          toast(t('edSourceSaved', next.title));
          renderSource();
          renderList();
          refreshBar();
        } catch (e) {
          msg.className = 'aisx-ed-msg is-err';
          msg.textContent = t('edNoLessons');
        } finally {
          apply.disabled = false;
        }
      } }, t('edUse'));
      box.replaceChildren(h('div', { class: 'aisx-crit' },
        h('p', { class: 'aisx-help' }, t('edCriteriaHelp')),
        selects.map(s => h('label', null, s.label, s.sel)),
        h('div', { class: 'aisx-crit-actions' }, apply, msg)));
    }

    function lessonRow(l) {
      const row = h('div', { class: 'aisx-ed-row' + (l.hidden ? ' is-hidden' : ''), 'data-key': l.key },
        l.custom
          ? h('span', { style: 'width:16px;flex:none' })
          : h('input', { type: 'checkbox', checked: !l.hidden, title: t('show'), 'aria-label': l.title, onchange: e => {
              const edits = getEdits();
              delete edits.hidden[l.oldKey];
              if (e.target.checked) delete edits.hidden[l.key];
              else edits.hidden[l.key] = true;
              setEdits(edits);
              renderList();
            } }),
        h('span', { class: 'aisx-ed-time' }, `${fmtMin(l.start)}–${fmtMin(l.end)}`),
        h('span', { class: 'aisx-ed-dot k-' + l.kind, title: kindName(l.kind) }),
        h('span', { class: 'aisx-ed-title', title: l.title }, l.title,
          l.custom ? h('span', { class: 'aisx-ed-tag' }, t('custom')) : l.edited ? h('span', { class: 'aisx-ed-tag' }, t('edited')) : null),
        h('span', { class: 'aisx-ed-meta' }, [l.room, l.teacher, parityName(l.parity)].filter(Boolean).join(' · ')),
        h('button', { class: 'aisx-icon-btn', type: 'button', title: t('edit'), 'aria-label': t('edit'), onclick: () => openForm(l, row) }, icon('edit', 14)),
        l.custom ? h('button', { class: 'aisx-icon-btn', type: 'button', title: t('del'), 'aria-label': t('del'), onclick: () => {
          const edits = getEdits();
          edits.custom = edits.custom.filter(c => 'c:' + c.id !== l.key);
          setEdits(edits);
          renderList();
        } }, icon('trash', 14)) : null);
      return row;
    }

    function renderList() {
      formEl = null;
      const all = effectiveLessons(true).sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.start - b.start);
      listBox.replaceChildren();
      if (!all.length) {
        listBox.append(h('p', { class: 'aisx-help' }, getCal().ttKey === sourceKey(getSource()) ? t('edEmpty') : t('ttLoading')));
        return;
      }
      let day = null;
      for (const l of all) {
        if (l.day !== day) {
          day = l.day;
          listBox.append(h('div', { class: 'aisx-ed-day' }, dayName(day)));
        }
        const row = lessonRow(l);
        listBox.append(row);
        if (focusKey && l.key === focusKey) {
          row.classList.add('is-focus');
          openForm(l, row);
          setTimeout(() => row.scrollIntoView({ block: 'center' }), 0);
        }
      }
      focusKey = null;
    }

    function openForm(l, row) {
      if (formEl) formEl.remove();
      const v = l || { title: '', kind: 'cvic', day: 1, start: 8 * 60, end: 9 * 60 + 50, room: '', teacher: '', parity: null };
      const opt = (value, label, selected) => h('option', { value, selected }, label);
      const f = {
        title: h('input', { type: 'text', value: v.title }),
        kind: h('select', null, [['pred', t('lecture')], ['cvic', t('seminar')], ['other', t('other')]].map(([k, n]) => opt(k, n, k === v.kind || (k === 'other' && !['pred', 'cvic'].includes(v.kind))))),
        parity: h('select', null, [['', t('every')], ['odd', t('odd')], ['even', t('even')]].map(([k, n]) => opt(k, n, (v.parity || '') === k))),
        day: h('select', null, DAY_ORDER.map(d => opt(String(d), dayName(d), v.day === d))),
        start: h('input', { type: 'time', value: toTime(v.start), step: '300' }),
        end: h('input', { type: 'time', value: toTime(v.end), step: '300' }),
        room: h('input', { type: 'text', value: v.room || '' }),
        teacher: h('input', { type: 'text', value: v.teacher || '' }),
      };
      const err = h('span', { class: 'aisx-ed-msg is-err' });
      const save = () => {
        const val = {
          title: clean(f.title.value), kind: f.kind.value, parity: f.parity.value || null, day: +f.day.value,
          start: toMin(f.start.value), end: toMin(f.end.value), room: clean(f.room.value), teacher: clean(f.teacher.value),
        };
        if (!val.title || isNaN(val.start) || isNaN(val.end) || val.start >= val.end) {
          err.textContent = t('edInvalid');
          return;
        }
        const edits = getEdits();
        if (!l) edits.custom.push(Object.assign({ id: Date.now().toString(36) }, val));
        else if (l.custom) edits.custom = edits.custom.map(c => ('c:' + c.id === l.key ? Object.assign({}, c, val) : c));
        else {
          delete edits.patch[l.oldKey];
          edits.patch[l.key] = val;
        }
        setEdits(edits);
        renderList();
      };
      formEl = h('div', { class: 'aisx-ed-form' },
        h('label', { class: 'is-wide' }, t('edName'), f.title),
        h('label', null, t('edKind'), f.kind),
        h('label', null, t('edWeeks'), f.parity),
        h('label', null, t('edDay'), f.day),
        h('label', null, t('edFrom'), f.start),
        h('label', null, t('edTo'), f.end),
        h('label', null, t('edRoom'), f.room),
        h('label', { class: 'is-wide' }, t('edTeacher'), f.teacher),
        h('div', { class: 'aisx-ed-actions' },
          h('button', { class: 'aisx-btn aisx-primary', type: 'button', onclick: save }, t('save')),
          h('button', { class: 'aisx-btn', type: 'button', onclick: () => { formEl.remove(); formEl = null; } }, t('cancel')),
          l && l.edited ? h('button', { class: 'aisx-btn', type: 'button', onclick: () => {
            const edits = getEdits();
            delete edits.patch[l.key];
            delete edits.patch[l.oldKey];
            setEdits(edits);
            renderList();
          } }, t('revert')) : null,
          err));
      formEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
          e.preventDefault();
          save();
        }
      });
      if (row) row.after(formEl);
      else listBox.prepend(formEl);
      f.title.focus();
    }

    renderSource();
    renderList();
  }

  /* ------------------------------------------------------------------ *
   * Home page: sections you can close and bring back                      *
   * ------------------------------------------------------------------ */
  // Hidden only in this browser (UIS is not told), so nothing else about the menu changes.
  function enhanceSections() {
    const sections = Array.from(document.querySelectorAll('#vsechny-polozky > .polozky-obal[id]'));
    if (!sections.length) return;
    const titleOf = sec => clean((sec.querySelector('.sekce-nadpis b') || {}).textContent) || clean((sec.querySelector('.menu-drzak') || {}).title) || sec.id;
    const row = h('div', { class: 'aisx-ui aisx-hidden-secs' });
    const setHidden = (id, title) => {
      const hidden = store.get('hiddenSections', {});
      if (title) hidden[id] = title;
      else delete hidden[id];
      store.set('hiddenSections', hidden);
      apply();
    };
    const apply = () => {
      const hidden = store.get('hiddenSections', {});
      sections.forEach(sec => sec.classList.toggle('aisx-sec-hidden', !!hidden[sec.id]));
      const ids = sections.map(sec => sec.id).filter(id => hidden[id]);
      row.style.display = ids.length ? '' : 'none';
      row.replaceChildren(
        h('span', null, t('hiddenSecs')),
        ...ids.map(id => h('button', { type: 'button', title: t('restoreSec', hidden[id]), onclick: () => setHidden(id, null) }, icon('undo', 13), hidden[id])),
        ...(ids.length > 1 ? [h('a', { href: '#', onclick: e => { e.preventDefault(); store.set('hiddenSections', {}); apply(); } }, t('restoreAll'))] : []));
    };
    for (const sec of sections) {
      const title = titleOf(sec);
      const close = h('button', { class: 'aisx-ui aisx-sec-x', type: 'button', title: t('hideSec'), 'aria-label': `${t('hideSec')}: ${title}`, onclick: e => {
        e.stopPropagation();
        setHidden(sec.id, title);
        toast(t('secHidden', title));
      } }, icon('x', 15));
      close.addEventListener('mousedown', e => e.stopPropagation()); // keep UIS's drag-and-drop out of it
      sec.append(close);
    }
    (document.querySelector('#menitko') || sections[0].parentElement).after(row); // below all the sections
    apply();
  }

  /* ------------------------------------------------------------------ *
   * Home page: notices and noticeboard in one drop-down                  *
   * ------------------------------------------------------------------ */
  const NOTICE_LABEL = { red: 'noticeRed', blue: 'noticeBlue', yellow: 'noticeYellow' };

  function compactNotices() {
    const box = document.querySelector('.zasadky-container');
    if (!settings.notices || !box || box.classList.contains('aisx-notices-box')) return;
    const notes = Array.from(box.children).filter(el => el.classList.contains('zasadka'));
    if (!notes.length) return;
    for (const note of notes) {
      const kind = note.classList.contains('vyveska') ? 'yellow' : note.querySelector('table.zasadky-crit') ? 'red' : 'blue';
      note.classList.add('n-' + kind);
      note.dataset.aisxLabel = t(NOTICE_LABEL[kind]);
    }
    // The boxes stay where UIS put them (their "remove" links keep working); only their container is restyled.
    box.classList.add('aisx-notices-box');
    let open = store.get('noticesOpen', false);
    const pills = h('span', { style: 'display:contents' });
    const toggleLabel = h('span', { class: 'aisx-nh-toggle' });
    const head = h('button', { class: 'aisx-ui aisx-notices-head', type: 'button' }, icon('bell', 17), h('b', null, t('notices')), pills, toggleLabel);
    // UIS fills the noticeboard in after the page loads, so the counts follow the boxes' contents.
    const count = () => {
      const counts = { red: 0, blue: 0, yellow: 0 };
      for (const note of notes) counts[note.classList.contains('n-red') ? 'red' : note.classList.contains('n-yellow') ? 'yellow' : 'blue'] += note.querySelectorAll('li').length;
      pills.replaceChildren(...Object.keys(counts).filter(k => counts[k]).map(k => h('span', { class: 'aisx-np n-' + k }, h('i'), `${counts[k]} ${t(NOTICE_LABEL[k])}`)));
    };
    let pending = null;
    new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(count, 150);
    }).observe(box, { childList: true, subtree: true });
    count();
    const sync = () => {
      box.classList.toggle('is-collapsed', !open);
      head.setAttribute('aria-expanded', String(open));
      toggleLabel.replaceChildren(open ? t('hide') : t('show'), icon(open ? 'up' : 'down', 15));
    };
    head.addEventListener('click', () => {
      open = !open;
      store.set('noticesOpen', open);
      sync();
    });
    box.before(head);
    sync();
  }

  /* ------------------------------------------------------------------ *
   * Quick search (Ctrl+K)                                               *
   * ------------------------------------------------------------------ */
  let overlay = null;

  function closeOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
  }

  function openOverlay(panel, onKey) {
    closeOverlay();
    overlay = h('div', { class: 'aisx-ui aisx-overlay', onmousedown: e => e.target === overlay && closeOverlay() }, panel);
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay();
      } else if (onKey) onKey(e);
    });
    document.body.append(overlay);
  }

  function collectItems() {
    const items = [];
    const seen = new Set();
    const add = item => {
      const key = item.u ? urlKey(item.u) : item.id;
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };
    getPins().forEach(p => add({ kind: 'fav', u: p.u, t: p.t, c: '' }));
    store.get('recent', []).forEach(r => r.u !== urlKey(location.href) && add({ kind: 'recent', u: r.u, t: r.t, c: '' }));
    const links = store.get('links', {});
    Object.entries(links)
      .sort((a, b) => (b[1].s || 0) - (a[1].s || 0))
      .forEach(([u, v]) => add({ kind: 'link', u, t: v.t, c: v.c, s: v.s }));
    const pinned = isPinned();
    add({ kind: 'cmd', id: 'timetable', t: t('cmdTimetable'), run: () => (location.href = timetableUrl()) });
    add({ kind: 'cmd', id: 'edit-tt', t: t('cmdEditTt'), run: () => openTimetableEditor() });
    add({ kind: 'cmd', id: 'dark', t: t('cmdDark'), run: toggleDark });
    add({ kind: 'cmd', id: 'pin', t: pinned ? t('unpin') : t('pin'), run: togglePin });
    add({ kind: 'cmd', id: 'settings', t: t('cmdSettings'), run: openSettings });
    add({ kind: 'cmd', id: 'off', t: t('cmdOff'), run: () => setEnabled(false) });
    items.forEach(it => (it.n = norm(it.t + ' ' + (it.c || ''))));
    return items;
  }

  function scoreItem(item, terms) {
    let score = 0;
    for (const term of terms) {
      const i = item.n.indexOf(term);
      if (i < 0) return -1;
      score += i === 0 ? 30 : item.n[i - 1] === ' ' ? 18 : 6;
    }
    score += item.kind === 'fav' ? 40 : item.kind === 'recent' ? 22 : item.kind === 'cmd' ? 4 : Math.min(15, Math.log2(1 + (item.s || 0)) * 3);
    return score - item.n.length / 50;
  }

  function shortUrl(u) {
    try {
      const url = new URL(u, location.href);
      return url.pathname.replace(/^\/auth\//, '/') + (url.search ? '…' : '');
    } catch (e) {
      return u;
    }
  }

  function openPalette() {
    if (!settings.enabled) return;
    const items = collectItems();
    const kindLabel = { fav: t('kindFav'), recent: t('kindRecent'), link: t('kindLink'), cmd: t('kindCmd') };
    const input = h('input', { class: 'aisx-pal-input', type: 'text', placeholder: t('searchPh'), autocomplete: 'off', spellcheck: 'false', 'aria-label': t('search') });
    const list = h('div', { class: 'aisx-pal-list', role: 'listbox' });
    let results = [];
    let active = 0;

    const setActive = i => {
      active = Math.max(0, Math.min(results.length - 1, i));
      Array.from(list.children).forEach((el, j) => el.classList.toggle('is-active', j === active));
      const el = list.children[active];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    };
    const choose = (item, newTab) => {
      if (!item) return;
      if (item.run) {
        closeOverlay();
        item.run();
      } else if (newTab) window.open(item.u, '_blank');
      else location.href = item.u;
    };
    const render = () => {
      const terms = norm(input.value).split(' ').filter(Boolean);
      results = terms.length
        ? items.map(it => [scoreItem(it, terms), it]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0]).slice(0, 60).map(x => x[1])
        : items.filter(it => it.kind !== 'cmd').slice(0, 40).concat(items.filter(it => it.kind === 'cmd'));
      list.replaceChildren(
        ...(results.length
          ? results.map((it, i) =>
              h(it.u ? 'a' : 'div', {
                class: 'aisx-pal-item',
                href: it.u || null,
                role: 'option',
                onmousemove: () => active !== i && setActive(i),
                onclick: e => {
                  if (it.run) {
                    e.preventDefault();
                    choose(it);
                  }
                },
              },
              h('span', { class: 'aisx-pal-kind' }, kindLabel[it.kind]),
              h('span', { class: 'aisx-pal-text' },
                h('span', { class: 'aisx-pal-title' }, it.t),
                it.kind !== 'cmd' ? h('span', { class: 'aisx-pal-sub' }, it.c && it.c !== it.t ? it.c : shortUrl(it.u)) : null))
            )
          : [h('div', { class: 'aisx-pal-empty' }, t('noResults'))])
      );
      setActive(0);
    };

    input.addEventListener('input', render);
    const panel = h('div', { class: 'aisx-panel', role: 'dialog', 'aria-label': t('search') },
      h('div', { class: 'aisx-pal-head' }, icon('search', 18), input, h('kbd', { class: 'aisx-kbd' }, 'Esc')),
      list,
      h('div', { class: 'aisx-pal-foot' }, t('shortcuts')));
    openOverlay(panel, e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(active + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(active - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        choose(results[active], e.ctrlKey || e.metaKey);
      }
    });
    render();
    input.focus();
  }

  /* ------------------------------------------------------------------ *
   * Settings                                                             *
   * ------------------------------------------------------------------ */
  function openSettings() {
    const set = (key, value) => {
      settings[key] = value;
      saveSettings();
      applyTheme();
    };
    const toggleRow = (key, label, after) =>
      h('div', { class: 'aisx-row' },
        h('label', { for: 'aisx-' + key }, label),
        h('input', { id: 'aisx-' + key, type: 'checkbox', checked: !!settings[key], onchange: e => { set(key, e.target.checked); after && after(); } }));
    const selectRow = (key, label, options) =>
      h('div', { class: 'aisx-row' },
        h('label', { for: 'aisx-' + key }, label),
        h('select', { id: 'aisx-' + key, onchange: e => {
          set(key, e.target.value);
          if (key === 'lang') {
            openSettings();
            refreshData(false); // class names come in the chosen language
          }
        } },
          options.map(([v, l]) => h('option', { value: v, selected: settings[key] === v }, l))));

    const pinsBox = h('div');
    const renderPins = () => {
      const pins = getPins();
      pinsBox.replaceChildren(
        ...(pins.length
          ? pins.map((p, i) =>
              h('div', { class: 'aisx-pinrow' },
                h('input', { type: 'text', value: p.t, 'aria-label': p.u, onchange: e => { const all = getPins(); all[i].t = clean(e.target.value) || all[i].t; setPins(all); } }),
                h('button', { class: 'aisx-btn aisx-danger', type: 'button', onclick: () => { setPins(getPins().filter((_, j) => j !== i)); renderPins(); } }, t('remove'))))
          : [h('p', { class: 'aisx-help' }, t('sPinsEmpty'))])
      );
    };
    renderPins();

    const cal = getCal();
    const status = h('span', null, t('dataStatus', !!cal.weeks, !!cal.tt));
    const refreshBtn = h('button', { class: 'aisx-btn', type: 'button', onclick: async () => {
      refreshBtn.textContent = t('refreshing');
      const ok = await refreshData(true);
      const c = getCal();
      status.textContent = t('dataStatus', !!c.weeks, !!c.tt);
      refreshBtn.textContent = t('refreshNow');
      toast(ok && c.tt ? t('refreshDone') : t('refreshFail'));
    } }, t('refreshNow'));

    const body = h('div', { class: 'aisx-set-body' },
      h('h5', null, t('sAppearance')),
      toggleRow('enabled', t('sEnabled')),
      selectRow('theme', t('sTheme'), [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]]),
      selectRow('density', t('sDensity'), [['comfortable', t('densComfortable')], ['compact', t('densCompact')]]),
      h('div', { class: 'aisx-row' },
        h('label', { for: 'aisx-fontSize' }, t('sFont')),
        h('input', { id: 'aisx-fontSize', type: 'range', min: '12', max: '18', step: '1', value: String(settings.fontSize), oninput: e => set('fontSize', +e.target.value) })),
      selectRow('lang', t('sLang'), [['auto', t('langAuto')], ['sk', 'Slovenčina'], ['en', 'English']]),

      h('h5', null, t('sFeatures')),
      toggleRow('topBar', t('sTopBar'), () => location.reload()),
      toggleRow('today', t('sToday'), () => {
        refreshBar();
        if (settings.today) refreshData(false);
      }),
      toggleRow('notices', t('sNotices'), () => location.reload()),
      toggleRow('tableTools', t('sTableTools'), () => location.reload()),
      toggleRow('grades', t('sGrades'), () => location.reload()),

      h('h5', null, t('sData')),
      h('div', { class: 'aisx-row' }, status, refreshBtn),
      h('p', { class: 'aisx-help' }, t('dataHelp')),

      h('h5', null, t('sPins')),
      pinsBox,

      h('h5', null, t('sHelp')),
      h('div', { class: 'aisx-row' },
        h('span', null, h('div', null, t('dump')), h('p', { class: 'aisx-help' }, t('dumpHelp'))),
        h('button', { class: 'aisx-btn', type: 'button', onclick: copyStructure }, icon('copy', 14), t('copy'))),
      h('div', { class: 'aisx-row' },
        h('span', null, t('reset')),
        h('button', { class: 'aisx-btn aisx-danger', type: 'button', onclick: () => {
          if (!confirm(t('resetConfirm'))) return;
          ['settings', 'links', 'cal', 'ids'].forEach(k => store.set(k, {}));
          ['pins', 'recent'].forEach(k => store.set(k, []));
          location.reload();
        } }, t('reset'))));

    const panel = h('div', { class: 'aisx-panel', role: 'dialog', 'aria-label': t('settings') },
      h('div', { class: 'aisx-set-head' },
        h('div', null, h('b', null, t('settings')), h('small', null, 'v' + VERSION)),
        h('button', { class: 'aisx-icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onclick: closeOverlay }, icon('x', 16))),
      body);
    openOverlay(panel);
    const first = panel.querySelector('input, select');
    if (first) first.focus();
  }

  /* ------------------------------------------------------------------ *
   * Tables                                                               *
   * ------------------------------------------------------------------ */
  const textCache = new WeakMap();
  const rowText = row => {
    let v = textCache.get(row);
    if (v == null) {
      v = norm(row.textContent);
      textCache.set(row, v);
    }
    return v;
  };
  const cellText = cell => clean(cell.innerText != null ? cell.innerText : cell.textContent);
  const hasSpan = row => Array.from(row.cells).some(c => c.colSpan > 1 || c.rowSpan > 1);

  function findHeaderRow(table, rows) {
    if (table.tHead && table.tHead.rows.length) return table.tHead.rows[table.tHead.rows.length - 1];
    for (const row of rows.slice(0, 2)) {
      const cells = Array.from(row.cells);
      if (cells.length < 2) continue;
      if (cells.every(c => c.tagName === 'TH') || row.classList.contains('zahlavi')) return row;
    }
    return null;
  }

  function processTable(table) {
    if (table.dataset.aisxDone) return;
    table.dataset.aisxDone = '1';
    if (table.closest('.aisx-ui, #hlavicka, .zasadka, .polozky-obal') || table.classList.contains('portal_menu') || table.querySelector('table')) return;
    if (table.querySelector('td[class^="rozvrh-"]:not(.rozvrh-sep)')) {
      table.classList.add('aisx-timetable');
      return;
    }
    const rows = Array.from(table.rows);
    if (rows.length < 2 || Math.max(...rows.map(r => r.cells.length)) < 2) return;

    const head = findHeaderRow(table, rows);
    if (!head) return;
    const headerRows = table.tHead ? Array.from(table.tHead.rows) : rows.slice(0, rows.indexOf(head) + 1);
    const bodyRows = rows.filter(r => !headerRows.includes(r) && !(r.parentElement && r.parentElement.tagName === 'TFOOT'));
    if (!bodyRows.length) return;

    table.classList.add('aisx-table');
    headerRows.forEach(r => r.classList.add('aisx-head'));
    if (bodyRows.some(r => Array.from(r.cells).some(c => c.rowSpan > 1))) return; // grid layouts: styling only

    const columns = head.cells.length;
    const uniform = r => r.cells.length === columns && !hasSpan(r);
    // Rows that fit the header grid. Trailing summary rows (e.g. totals) stay pinned at the end.
    let lastUniform = bodyRows.length - 1;
    while (lastUniform >= 0 && !uniform(bodyRows[lastUniform])) lastUniform--;
    const sortRows = bodyRows.slice(0, lastUniform + 1);
    const sortable =
      sortRows.length >= 2 &&
      sortRows.every(uniform) &&
      !hasSpan(head) &&
      sortRows.every(r => r.parentElement === sortRows[0].parentElement);

    const uniformRows = bodyRows.filter(uniform);
    if (settings.grades) safely('grade summary', () => gradeSummary(table, head, uniformRows));
    // Tools only where they help: real lists with several columns, not small key/value boxes.
    if (!settings.tableTools || uniformRows.length < 6 || columns < 3 || hasSpan(head)) return;
    const extraRows = bodyRows.filter(r => !uniformRows.includes(r));
    addTableTools(table, head, uniformRows, extraRows, sortable ? sortRows : null);
  }

  function addTableTools(table, head, bodyRows, extraRows, sortRows) {
    const count = h('span', { class: 'aisx-tt-count' }, t('rows', bodyRows.length, bodyRows.length));
    const filter = h('input', { class: 'aisx-tt-filter', type: 'search', placeholder: t('filter'), 'aria-label': t('filter') });
    const visibleRows = () => bodyRows.filter(r => !r.classList.contains('aisx-hidden'));

    filter.addEventListener('input', () => {
      const terms = norm(filter.value).split(' ').filter(Boolean);
      let shown = 0;
      for (const row of bodyRows) {
        const hay = rowText(row);
        const ok = terms.every(term => hay.includes(term));
        row.classList.toggle('aisx-hidden', !ok);
        if (ok) shown++;
      }
      extraRows.forEach(row => row.classList.toggle('aisx-hidden', terms.length > 0));
      count.textContent = t('rows', shown, bodyRows.length);
    });
    filter.addEventListener('keydown', e => {
      if (e.key === 'Escape' && filter.value) {
        e.preventDefault();
        filter.value = '';
        filter.dispatchEvent(new Event('input'));
      }
    });

    const asMatrix = () => [head, ...visibleRows()].map(r => Array.from(r.cells).map(cellText));
    const toolbar = h('div', { class: 'aisx-ui aisx-tt' },
      h('span', { class: 'aisx-tt-search' }, icon('search', 14), filter),
      count,
      h('button', { class: 'aisx-btn', type: 'button', title: t('copyTitle'), onclick: async () => {
        const tsv = asMatrix().map(r => r.map(c => c.replace(/\t/g, ' ')).join('\t')).join('\n');
        if (await copyText(tsv)) toast(t('copied'));
      } }, icon('copy', 14), t('copy')),
      h('button', { class: 'aisx-btn', type: 'button', title: t('csvTitle'), onclick: () => {
        const csv = asMatrix().map(r => r.map(c => (/[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(';')).join('\r\n');
        const name = (norm(pageTitle()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ais') + '.csv';
        downloadText(name, csv, 'text/csv;charset=utf-8');
      } }, icon('download', 14), t('csv')));

    table.parentNode.insertBefore(toolbar, table);
    const syncWidth = () => (toolbar.style.width = table.offsetWidth >= 420 ? table.offsetWidth + 'px' : '');
    syncWidth();
    if (window.ResizeObserver) new ResizeObserver(syncWidth).observe(table);
    if (sortRows) makeSortable(head, sortRows);
  }

  const NUM_RE = /^[-+−]?\d{1,3}(?:[  ]?\d{3})*(?:[.,]\d+)?\s*(?:%|€|kr\.?|b\.?|bodov)?$/i;
  const DATE_RE = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/;
  const parseNum = s => parseFloat(s.replace(/[  ]/g, '').replace('−', '-').replace(',', '.'));
  const parseDate = s => {
    const m = DATE_RE.exec(s);
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : NaN;
  };
  const collator = new Intl.Collator('sk', { numeric: true, sensitivity: 'base' });

  function makeSortable(head, sortRows) {
    const original = sortRows.slice();
    const parent = sortRows[0].parentElement;
    Array.from(head.cells).forEach((th, col) => {
      // Header cells with links or form controls already do something on click (often server-side sorting).
      if (th.querySelector('a, input, select, button') || !clean(th.textContent)) return;
      th.classList.add('aisx-sortable');
      th.title = th.title || t('sortTitle');
      th.tabIndex = 0;
      const run = () => {
        const state = th.dataset.aisxSort === 'asc' ? 'desc' : th.dataset.aisxSort === 'desc' ? '' : 'asc';
        Array.from(head.cells).forEach(c => delete c.dataset.aisxSort);
        let ordered = original;
        if (state) {
          const values = new Map(sortRows.map(r => [r, cellText(r.cells[col])]));
          const filled = [...values.values()].filter(Boolean);
          const share = re => filled.filter(v => re.test(v)).length / Math.max(1, filled.length);
          const type = share(NUM_RE) >= 0.7 ? 'num' : share(DATE_RE) >= 0.7 ? 'date' : 'text';
          const key = v => (type === 'num' ? parseNum(v) : type === 'date' ? parseDate(v) : v);
          ordered = original.slice().sort((a, b) => {
            const va = values.get(a);
            const vb = values.get(b);
            if (!va || !vb) return va ? -1 : vb ? 1 : 0; // empty cells always last
            const ka = key(va);
            const kb = key(vb);
            const cmp = type === 'text' ? collator.compare(ka, kb) : (isNaN(ka) ? Infinity : ka) - (isNaN(kb) ? Infinity : kb);
            return state === 'asc' ? cmp : -cmp;
          });
          th.dataset.aisxSort = state;
        }
        // Re-insert just after the last sortable row, so trailing summary rows stay where they are.
        const members = new Set(sortRows);
        let last = null;
        for (const el of parent.children) if (members.has(el)) last = el;
        const marker = document.createComment('aisx');
        parent.insertBefore(marker, last.nextSibling);
        ordered.forEach(r => parent.insertBefore(r, marker));
        marker.remove();
      };
      th.addEventListener('click', run);
      th.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          run();
        }
      });
    });
  }

  /* Grade colouring and summary ------------------------------------------ */
  const GRADE_VALUE = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 };
  const GRADE_RE = /(?:^|[\s(,;:/])(F[Xx]|A|B|C|D|E)(?=$|[\s),;:.\/-])/;
  const CREDIT_HEAD_RE = /kred|^kr\.?$|ects|credit/;
  const GRADE_HEAD_RE = /hodnot|znamk|vysled|klasif|grade|result|mark/;

  function gradeSummary(table, head, rows) {
    if (rows.length < 1) return;
    const headers = Array.from(head.cells).map(c => norm(c.textContent));
    const creditCol = headers.findIndex(x => CREDIT_HEAD_RE.test(x));
    if (creditCol < 0) return;
    // Pick the grade column whose cells actually contain grades (avoids e.g. "type of assessment").
    let gradeCol = -1;
    let best = 0;
    headers.forEach((x, i) => {
      if (!GRADE_HEAD_RE.test(x) || i === creditCol) return;
      const hits = rows.filter(r => GRADE_RE.test(cellText(r.cells[i]))).length;
      if (hits > best) {
        best = hits;
        gradeCol = i;
      }
    });
    if (gradeCol < 0) return;

    const dist = { A: 0, B: 0, C: 0, D: 0, E: 0, FX: 0 };
    let weighted = 0;
    let gradedCredits = 0;
    let earned = 0;
    let graded = 0;
    let pending = 0;
    for (const row of rows) {
      const credits = parseInt((cellText(row.cells[creditCol]).match(/\d+/) || [])[0], 10);
      const m = GRADE_RE.exec(cellText(row.cells[gradeCol]));
      if (!m) {
        pending++;
        continue;
      }
      const grade = m[1].toUpperCase();
      row.cells[gradeCol].classList.add('aisx-grade-' + grade);
      dist[grade]++;
      graded++;
      if (!credits) continue;
      weighted += GRADE_VALUE[grade] * credits;
      gradedCredits += credits;
      if (grade !== 'FX') earned += credits;
    }
    // UIS prints its own averages under the E-index; only add a summary where it does not.
    const aisHasStats = Array.from(document.querySelectorAll('table')).some(tb => tb !== table && /priemer|average/i.test(tb.textContent));
    if (!graded || aisHasStats) return;

    const fmt = n => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const colors = { A: 'var(--aisx-g-a)', B: 'var(--aisx-g-b)', C: 'var(--aisx-g-c)', D: 'var(--aisx-g-d)', E: 'var(--aisx-g-e)', FX: 'var(--aisx-g-fx)' };
    const card = h('div', { class: 'aisx-ui aisx-card' },
      h('h4', null, t('gradesTitle')),
      h('div', { class: 'aisx-stats' },
        h('div', { class: 'aisx-stat' }, h('b', null, gradedCredits ? fmt(weighted / gradedCredits) : '–'), h('small', null, t('avg'))),
        h('div', { class: 'aisx-stat' }, h('b', null, String(earned)), h('small', null, t('credits') + ' · ' + t('ofCredits', gradedCredits))),
        h('div', { class: 'aisx-stat' }, h('b', null, String(graded)), h('small', null, t('graded') + (pending ? ' · ' + t('pendingN', pending) : '')))),
      h('div', { class: 'aisx-dist' },
        Object.entries(dist).filter(([, n]) => n).map(([g, n]) => h('span', { style: 'background:' + colors[g] }, g, h('i', null, '× ' + n)))),
      h('p', { class: 'aisx-note' }, t('gradesNote')));
    table.parentNode.insertBefore(card, table);
  }

  /* ------------------------------------------------------------------ *
   * Page-specific touches                                                *
   * ------------------------------------------------------------------ */
  // Portal tab strips contain spacer cells; hide them so the tabs wrap cleanly.
  function tidyTabs() {
    document.querySelectorAll('table.portal_menu td').forEach(td => {
      if (!td.querySelector('a')) td.classList.add('aisx-hide');
    });
  }

  // On the timetable page: highlight today, mark the ongoing/next class, fade classes that do not
  // take place in the shown week (odd/even weeks, days off).
  function enhanceTimetablePage() {
    const parsed = parseTimetable(document, true);
    if (!parsed) return;
    // Which timetable is this? The personal one (by id), one posted from the criteria form, or unknown.
    let posted = null;
    try {
      posted = location.search ? null : JSON.parse(sessionStorage.getItem('aisx-ttq') || 'null');
    } catch (e) {
      posted = null;
    }
    const ids = getIds();
    const own = /rozvrh_student=(\d+)/.exec(location.href);
    const personal = (own && own[1] === ids.rozvrh) || (posted && (posted.osobni || posted.rozvrh_student === ids.rozvrh));
    // Public (logged-out) timetable pages are never offered to UIS+ and never touch the saved timetable.
    const pageSource = !loggedIn() ? undefined : personal ? null : posted ? { title: docTitle(document), params: posted } : undefined;
    const plain = { lessons: parsed.lessons.map(({ cell, ...l }) => l), from: parsed.from, to: parsed.to };
    const inUse = () => pageSource !== undefined && sourceKey(pageSource) === sourceKey(getSource());
    if (inUse()) setCal({ tt: plain, ttAt: Date.now(), ttKey: sourceKey(pageSource), ttLang: pageLang(), ttError: false });
    let useBtn = null;
    if (pageSource !== undefined) {
      useBtn = h('button', { class: 'aisx-btn', type: 'button', onclick: () => {
        store.set('ttSource', pageSource);
        setCal({ tt: plain, ttAt: Date.now(), ttKey: sourceKey(pageSource), ttLang: pageLang(), ttError: false });
        toast(t('useSaved'));
        paint();
        refreshBar();
      } });
      const paint = () => {
        const on = inUse();
        useBtn.className = 'aisx-btn' + (on ? ' is-on' : '');
        useBtn.disabled = on;
        useBtn.replaceChildren(icon(on ? 'tick' : 'plus', 14), on ? t('usedInAis') : t('useInAis'));
      };
      paint();
    }
    const now = new Date();
    // On weekends show the coming week.
    const base = now.getDay() === 0 ? addDays(now, 1) : now.getDay() === 6 ? addDays(now, 2) : now;
    const monday = addDays(base, -((base.getDay() + 6) % 7));
    const wk = weekOf(base);
    const m = nowMin(now);
    const todayIdx = now.getDay();

    const grid = parsed.lessons[0].cell.closest('table');
    let day = null;
    for (const row of Array.from(grid.rows).slice(1)) {
      const label = clean(row.cells[0] ? row.cells[0].textContent : '');
      if (label) day = dayIndex(label);
      if (day === todayIdx && !row.classList.contains('rozvrh-sep')) row.classList.add('aisx-today');
    }

    const upcomingToday = [];
    for (const l of parsed.lessons) {
      const date = addDays(monday, (l.day + 6) % 7);
      const iso = isoDate(date);
      const offParity = l.parity && wk && (l.parity === 'odd') !== wk.odd;
      const offDay = l.off.includes(iso);
      if (offParity || offDay) {
        l.cell.classList.add('aisx-offweek');
        l.cell.title = offDay ? t('dayOff') : t('notThisWeek', wk.odd ? (lang() === 'sk' ? 'nepárny' : 'odd') : lang() === 'sk' ? 'párny' : 'even');
      } else if (l.day === todayIdx && isoDate(now) === iso && l.end > m) upcomingToday.push(l);
    }
    upcomingToday.sort((a, b) => a.start - b.start);
    const first = upcomingToday[0];
    if (first) {
      const isNow = first.start <= m;
      first.cell.classList.add(isNow ? 'aisx-now' : 'aisx-next');
      first.cell.firstElementChild && first.cell.firstElementChild.setAttribute('data-aisx-label', isNow ? t('now') : t('next'));
    }

    const legend = h('div', { class: 'aisx-ui aisx-ttbar' },
      h('span', { class: 'aisx-key' }, h('i', { style: 'background:var(--aisx-lec)' }), t('lecture')),
      h('span', { class: 'aisx-key' }, h('i', { style: 'background:var(--aisx-sem)' }), t('seminar')),
      wk ? h('span', null, t('ttLegend', wk.n, wk.odd)) : null,
      useBtn);
    grid.parentNode.insertBefore(legend, grid);
  }

  // Remember what was asked for on the UIS Timetables page, so its result can be used in UIS+.
  function rememberTimetableQuery() {
    if (!/rozvrhy_view\.pl/.test(location.pathname)) return;
    document.addEventListener('submit', e => {
      const form = e.target;
      if (!form || form.tagName !== 'FORM' || !/rozvrhy_view\.pl/.test(form.getAttribute('action') || location.pathname)) return;
      const params = {};
      new FormData(form).forEach((v, k) => {
        if (typeof v === 'string') params[k] = v;
      });
      if (e.submitter && e.submitter.name) params[e.submitter.name] = e.submitter.value;
      try {
        sessionStorage.setItem('aisx-ttq', JSON.stringify(params));
      } catch (err) {
        /* private mode: the button just won't be offered */
      }
    }, true);
  }

  function enhanceWeeksPage() {
    if (!/prehled_tydnu\.pl/.test(location.pathname)) return;
    const weeks = parseWeeks(document);
    const ids = getIds();
    if (weeks && ids.studium && ids.obdobi) setCal({ weeks, weeksAt: Date.now(), weeksKey: ids.studium + '/' + ids.obdobi });
  }

  // Elements that already have a dark background would turn light when the page is inverted;
  // marking them re-inverts them so they keep their original colours.
  function markDarkRegions() {
    const all = document.body.getElementsByTagName('*');
    if (all.length > 25000) return;
    const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|IMG|SVG|VIDEO|PICTURE|CANVAS|IFRAME|OBJECT|EMBED|BR|OPTION|INPUT|BUTTON|SELECT|TEXTAREA)$/;
    const channel = v => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const isDarkBg = el => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(el).backgroundColor);
      if (!m || (m[4] !== undefined && +m[4] < 0.5)) return false;
      return 0.2126 * channel(+m[1]) + 0.7152 * channel(+m[2]) + 0.0722 * channel(+m[3]) < 0.18;
    };
    const walk = el => {
      for (const child of el.children) {
        if (SKIP.test(child.tagName) || child.classList.contains('aisx-ui') || child.id === 'hlavicka') continue;
        if (isDarkBg(child)) child.classList.add('aisx-keepdark');
        else walk(child);
      }
    };
    walk(document.body);
  }

  function wrapWideTables() {
    for (const table of document.querySelectorAll('table.aisx-table')) {
      const parent = table.parentElement;
      if (!parent || parent.classList.contains('aisx-scroll')) continue;
      if (table.offsetWidth > parent.clientWidth + 4) {
        const wrap = h('div', { class: 'aisx-scroll' });
        parent.insertBefore(wrap, table);
        wrap.append(table);
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Page structure export (for improving the script)                     *
   * ------------------------------------------------------------------ */
  function structureOf(root) {
    const out = [];
    const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|META|LINK|BR)$/;
    const sig = el => {
      const cls = Array.from(el.classList).filter(c => !c.startsWith('aisx')).map(c => '.' + c).join('');
      return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls;
    };
    const describe = el => {
      let s = sig(el);
      const attrs = ['colspan', 'rowspan', 'bgcolor', 'role', 'type', 'name'].filter(a => el.hasAttribute(a)).map(a => `${a}=${el.getAttribute(a)}`);
      if (attrs.length) s += ' [' + attrs.join(' ') + ']';
      if (el.tagName === 'A') {
        try {
          const u = new URL(el.getAttribute('href') || '', location.href);
          const params = u.search.replace(/^\?/, '').split(/[;&]/).filter(Boolean).map(p => p.split('=')[0]);
          s += ' → ' + u.pathname + (params.length ? '?' + params.join(',') : '');
        } catch (e) {
          /* ignore */
        }
      }
      if (/^(H1|H2|H3|H4|TH|LEGEND|CAPTION|LABEL|BUTTON)$/.test(el.tagName) || (el.tagName === 'INPUT' && /submit|button/.test(el.type))) {
        s += ' "' + clean(el.textContent || el.value).slice(0, 50) + '"';
      }
      return s;
    };
    const walk = (el, depth) => {
      if (out.length > 3500 || depth > 25) return;
      if (SKIP.test(el.tagName) || el.classList.contains('aisx-ui') || el.id === 'hlavicka') return;
      out.push('  '.repeat(depth) + describe(el));
      const kids = Array.from(el.children).filter(k => !SKIP.test(k.tagName) && !k.classList.contains('aisx-ui'));
      for (let i = 0; i < kids.length; i++) {
        let run = 1;
        while (i + run < kids.length && sig(kids[i + run]) === sig(kids[i])) run++;
        walk(kids[i], depth + 1);
        if (run > 1) {
          if (run > 2) out.push('  '.repeat(depth + 1) + `… ${run - 1} more ${sig(kids[i])}`);
          else walk(kids[i + 1], depth + 1);
          i += run - 1;
        }
      }
    };
    walk(root, 0);
    return out.join('\n');
  }

  async function copyStructure() {
    const head = [
      `UIS+ ${VERSION} page structure`,
      `path: ${location.pathname}`,
      `viewport: ${innerWidth}x${innerHeight}`,
      'stylesheets: ' + Array.from(document.styleSheets).map(s => (s.href ? new URL(s.href).pathname : 'inline')).join(', '),
      '',
    ].join('\n');
    const text = head + structureOf(document.body);
    if (await copyText(text)) toast(t('dumped'));
    else downloadText('ais-structure.txt', text, 'text/plain;charset=utf-8');
  }

  /* ------------------------------------------------------------------ *
   * Keyboard shortcuts and the off switch                                *
   * ------------------------------------------------------------------ */
  function addOffPill() {
    document.body.append(h('button', { class: 'aisx-ui aisx-offpill', type: 'button', onclick: () => setEnabled(true) }, t('offPill')));
  }

  addEventListener('keydown', e => {
    if (!settings.enabled) return;
    const key = (e.key || '').toLowerCase();
    if (key === 'escape' && menu) {
      closeMenu();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'k' && loggedIn()) {
      e.preventDefault();
      if (overlay) closeOverlay();
      else openPalette();
      return;
    }
    if (overlay || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (key === '/') {
      const f = document.querySelector('.aisx-tt-filter');
      if (f) {
        e.preventDefault();
        f.scrollIntoView({ block: 'center' });
        f.focus();
      }
    }
  }, true);

  /* ------------------------------------------------------------------ *
   * Start                                                                *
   * ------------------------------------------------------------------ */
  function processTables(root) {
    root.querySelectorAll('table:not([data-aisx-done])').forEach(table => safely('table', () => processTable(table)));
  }

  function init() {
    safely('ids', () => learnIds(document));
    safely('weeks page', enhanceWeeksPage);
    safely('header bar', buildBar);
    safely('tabs', tidyTabs);
    safely('notices', compactNotices);
    safely('sections', enhanceSections);
    safely('statistics', foldOperInfo);
    safely('help panel', enhanceHelp);
    safely('timetable query', rememberTimetableQuery);
    safely('tables', () => processTables(document));
    safely('timetable', () => document.querySelector('table.aisx-timetable') && enhanceTimetablePage());
    safely('wide tables', wrapWideTables);
    safely('dark regions', markDarkRegions);
    safely('off switch', addOffPill);
    safely('history', rememberVisit);
    safely('link index', harvestLinks);
    safely('bar refresh', refreshBar);
    // Load the semester data (and, once, your login name) in the background once the page itself is done.
    setTimeout(() => refreshData(false), 400);
    setTimeout(loadLogin, 900);
    // Keep the "now / next class" chip current.
    setInterval(() => !overlay && !menu && refreshBar(), 60 * 1000);

    // Some UIS pages swap content in place; enhance tables that appear later.
    let pending = null;
    new MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        if (document.querySelector('table:not([data-aisx-done])')) processTables(document);
      }, 300);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
