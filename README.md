# UIS STU+

A userscript that makes STU's University Information System ([is.stuba.sk](https://is.stuba.sk)) cleaner, easier to use and more informative. It restyles the pages you already use and adds a few things UIS doesn't have, like a live timetable on every page.

Everything runs in your browser. The script only ever talks to is.stuba.sk, and what it remembers (pins, timetable edits, settings) stays in your userscript manager.

## Install

1. Install a userscript manager: [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/) (Firefox, Chrome, Edge).
2. Open **[uis-stu-plus.user.js](https://raw.githubusercontent.com/Manerger/uis-stu-plus/main/uis-stu-plus.user.js)**. Your manager offers to install it.
3. Go to [is.stuba.sk/auth](https://is.stuba.sk/auth/).

Your manager checks the same link for new versions.

## What it does

**Top bar**
- A slim bar with the STU logo, where you are in UIS (with a home button) and a search box. Press **Ctrl+K** to search pages, courses and links. UIS+ learns links from every UIS page you open, so search gets better as you browse.
- ☆ pins the current page to a favourites row under the bar.
- A profile menu with your messages, new documents and tasks, your school login, today's name day, dark mode, settings, help, language and log out.

**Timetable on every page**
- Your timetable sits under the bar, with a line that shows the current time. It also shows the semester week (odd or even) and your next class.
- Pick **Week**, **Day** or **Mini**, or hide it. Each part of UIS remembers its own view. The full timetable shows on the main page, in My College and in e-learning. Elsewhere it starts as Mini.
- Edit it with **⋯ → Edit timetable**: hide classes, change rooms or times, or add your own. You can also pick a different timetable with the same criteria as UIS's Timetables page (room, teacher, course, programme, year, group…).
- Course names follow the UIS language (Slovak or English).

**Home page**
- Alerts, information and the noticeboard are folded into one red/blue/yellow bar that opens on click.
- Close any section with **×**. Closed sections are listed at the bottom of the page, where you can bring them back.
- The usage statistics hide behind a small **∑**.

**Everywhere else**
- Tables: filter rows, click a column to sort, and copy or download the visible rows as CSV.
- Grades: an unofficial weighted average and credit summary above your results table.
- Tidier tabs and timetable pages, and the help panel labels in Slovak or English. (The help text itself exists only in Czech on the UIS server.)
- Dark mode (automatic, light or dark), compact density and font size, in **UIS+ settings**.

On public pages, or when you're logged out, UIS+ only restyles the page. It never shows your timetable or anything personal there.

## Turning it off

Open **UIS+ settings** and switch it off, or disable the script in your userscript manager. Either way, UIS goes back to its original look.

## Notes

UIS+ isn't an official STU project. If UIS changes its pages, parts of the script may stop working until it's updated.
