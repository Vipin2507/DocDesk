# Buildesk Document Studio

Document Studio turns an uploaded PDF or PDFMake JSON file into a reusable template. People fill the detected fields, preview the document, and download a PDF. The saved template is not changed when a document is generated.

This workspace was empty, and Buildesk Compass is a separate onboarding product whose Documents screen only tracks template status. Studio is a Buildesk application with the same product language: a light workspace, a dark sidebar, session login, SQLite, and role checks.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL, usually http://localhost:5173. The API listens on port 8787 and is proxied at `/api`.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 8 characters) before the first start. The account is created only when the user table is empty.

### Production / Render

`npm start` does **not** require a `.env` file. Set environment variables in the host dashboard instead. Render injects `PORT` automatically.

Required on first boot:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (8+ characters)
- `SESSION_SECRET`
- `COOKIE_SECURE=true` when the site is served over HTTPS

Optional: `DATA_DIR`, `DATABASE_URL`, AI keys. Free Render disks are ephemeral, so uploaded files and SQLite data reset when the instance is replaced.

On first boot the server seeds the 14 committed demand/receipt masters from `data/masters/` into SQLite. The Studio dashboard can still show **0 templates** until you open **Masters** and click **Create document**.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API and web app together |
| `npm run test` | Engine, API, and PDF tests |
| `npm run typecheck` | Typecheck the web app and the server |
| `npm run build` | Production web build |
| `npm start` | Serve the API and, when `dist/` exists, the built app |

## What it does

- Upload a text PDF or a pure JSON file. JavaScript is rejected and never executed.
- Exact PDF layout keeps each original page as the visual background and overlays editable fields on `$MergeToken` values from the text layer. Rebuild the sample demand/receipt masters with `npm run masters:rebuild`.
- Standard extraction reads text positions, page size, and simple tables, then says clearly that the reconstruction is approximate.
- AI reconstruction and AI variable detection call OpenAI or Anthropic only when a server key is configured. Invalid model output is discarded.
- Scanned pages with no text layer are sent through OCR when the canvas runtime can render them.
- Variables use `{{variable_id}}` placeholders. Repeated values can share one field.
- The visual editor and the Monaco JSON editor edit the same definition. Invalid JSON is kept on screen with line and column errors.
- Preview and download both go through PDFMake with the Roboto fonts in `server/fonts`.
- Templates keep version history. Generated PDFs are stored separately.

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file, for example `file:./data/document-studio.db` |
| `DATA_DIR` | Uploads, generated PDFs, and temporary files |
| `SESSION_SECRET` | Reserved for deployment hardening; sessions are random tokens stored hashed in SQLite |
| `COOKIE_SECURE` | Set `true` behind HTTPS |
| `PORT` | API port, default `8787` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First administrator |
| `CLIENT_ORIGIN` | Browser origins allowed to call the API |
| `DOCUMENT_AI_PROVIDER` | `auto`, `openai`, or `anthropic` |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | OpenAI-compatible chat completions |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Anthropic messages API |
| `AI_MAX_PAGES` | Pages sent to a model, default 4 |

AI keys are read only on the server.

## Roles

| Role | Access |
| --- | --- |
| Viewer | Browse, preview, generate, download |
| Editor | Viewer, plus upload, edit, duplicate, and restore |
| Admin | Editor, plus delete |

## Layout

```
shared/     document model, variables, binding, formatting
server/     Express API, SQLite, PDF extraction, PDFMake, AI adapter
src/        React workspace
tests/      Engine, API, and PDF fixtures exercised in code
```

Original PDFs and generated files live under `data/` and are served only to a signed-in user. Remote image URLs are removed so the server does not fetch them.
