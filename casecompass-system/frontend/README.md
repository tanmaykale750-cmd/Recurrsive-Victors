# CaseCompass frontend

React 19 + Vite + Tailwind CSS v4. See the project README in the repository root for setup, architecture and features.

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api to the FastAPI backend on :8000)
npm run build    # production build in dist/ (served by the backend in Docker)
```

- `src/state/CaseStore.jsx` talks to the API; `src/data/caseData.js` holds the live case bundle.
- `src/state/AuthStore.jsx` handles sign-in and registration.
- Design tokens are in `src/index.css`; design notes are in `../docs/design.md`.
- Set `VITE_API_URL` to call an API on another origin (default: same origin).
