# Case studies — Phase 6 workflow

> *"Every new automation experiment becomes another documented case study."*
> The objective is not to make every project huge. The objective is to demonstrate increasing understanding.

This folder is the repeatable documentation loop for the Automation Lab.

## Adding a new case study

1. **Copy** `_template.html` → `<slug>.html` (lowercase-with-hyphens, e.g. `rag-knowledge-base.html`).
2. **Fill all 16 sections** — business problem → goal → diagram → payload → data flow → credentials → APIs → transformations → output → failure tests → what broke → root cause → fix → final state → lessons → next version. Delete the guidance comments as you go.
3. **Add media** to `assets/portfolio/` (`.webp` / `.png` / `.mp4`) and reference it as `../assets/portfolio/<file>` — the build copies those formats automatically.
4. **Wire it in:**
   - Add or update a card/link in the portfolio section of `index.html` (`system-link` / `case-study-link`).
   - Add the URL to `sitemap.xml` (priority `0.8`, matching the existing case-study entry).
5. **Cache-bust:** if any CSS changed, bump the `?v=` query on `index.html` *and* every page in this folder that links it.
6. **Build & verify:** `npm run build` → check `public/case-studies/` contains your new file and **not** `_template.html` or this README.
7. **Commit & push** per the standard push workflow.

## Conventions

- **No inline styles** — the deployed CSP is `style-src 'self'`. Use the shared classes in `case-studies.css`.
- **Honest framing** — hands-on personal projects and self-study, never presented as paid client work. Keep the `case-doc-note` in every study.
- **Show the failures** — sections 10–13 (break / debug / fix) are the point. A case study without documented failures is a demo, not documentation.
- **Assets stay sanitized** — no API keys, tokens, or personal data in screenshots or payloads.
- **`_`-prefixed files and `README.md` are build-excluded** by `scripts/build-public.ps1`.
