# Page override — Take a seat (`/`)

Inherits `../MASTER.md`. Only differences are listed.

- **Job:** pick your name, optionally fix how it is displayed, sit down. Ten seconds.
- **Layout:** one centred column, max 420px, on bare felt. No panel around the
  form: the form is the page.
- **Who is here:** instead of a native `<select>`, the crew is a grid of name
  buttons (2 columns on a phone, 3 from 480px). A name already seated shows
  "Seated" beside it; choosing it explains that this opens a second session.
- **Heading:** Besley `display`. This is the only place the display size is used.
- **Primary action:** "Take a seat" (brass), disabled until a name is chosen.
- **Secondary:** a plain link to the community board, described in one line
  ("Put the board on the TV").
- **Empty and failure states:** while names load, show placeholder rows; if the
  list cannot load, say so and offer "Try again".
