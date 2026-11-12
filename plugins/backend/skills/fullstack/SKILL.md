---
name: fullstack
description: Build a feature across frontend and backend at the same time - agree the API contract first, run the API and frontend dev servers side by side with devctl, split the work between parallel agents, and verify the integration in a real browser. Use for any feature that touches both UI and API, or when the user asks to build a full-stack app.
argument-hint: "[feature]"
---

# Full-stack features in parallel

Frontend and backend can be built at the same time once they agree on one thing: the **contract**, meaning the routes, request/response schemas, and error shapes. Everything else is independent.

## 1. Contract first (main agent, ~5 minutes)
1. Write the feature's endpoints as zod-openapi route definitions in `api/src/routes/<resource>.ts`. Fill in schemas and `responses`, and make each handler a **stub** that returns realistic hard-coded data with the right status. Mount the router in `src/app.ts`.
2. `cd api && npm run typecheck && npm run openapi`. This writes `api/openapi.json`, the single source of truth.
3. Frontend: `npx openapi-typescript ../api/openapi.json -o src/lib/api-types.ts`.
4. Commit or otherwise checkpoint. From here, the frontend calls real `/api/...` URLs and gets the stub data. There's no mock server to maintain or throw away.

Contract rules: follow the `rest-api` skill. List endpoints return `{ items, nextCursor }`, errors are problem+json, dates are ISO strings, and ids are strings.

## 2. Run both servers (shared by everyone)
```bash
devctl start api --port 8787 --cwd api -- npm run dev
devctl start web --port 5173 --cwd web -- npm run dev
devctl status                 # both should be "running"
```
Both restart themselves on file changes. Read errors with `devctl logs api --grep error` and `devctl logs web`. A human can `tail -f .dev/logs/api.log` at the same time.

## 3. Build in parallel
When the user wants parallel work, or the feature is big enough to split, start subagents in the same turn so they run concurrently:
- **`backend-builder` agent**: "Implement the handlers in api/src/routes/<resource>.ts against openapi.json: schema + migration + real queries + tests. Don't change the contract without reporting it." It works only in `api/`.
- **Frontend work** (main agent, or a general-purpose agent with the frontend skills): build the UI against the typed client, covering loading, empty, and error states, plus field errors from the 422 `errors[]` array.

Rules that keep parallel work safe:
- Each agent owns one directory (`api/` or `web/`). Shared files (`openapi.json`, `api-types.ts`) change only through the contract step.
- If the backend must change the contract, it updates the route schema, reruns `npm run openapi`, and says so in its report. The main agent then regenerates the frontend types and runs `tsc` in the frontend, so any mismatch shows up as a type error.
- Don't run the two agents in separate git worktrees unless they'll each start their own servers on their own ports. One shared pair of dev servers is simpler.

## 4. Integrate and verify
1. Backend: `cd api && npm test && npm run typecheck`. Frontend: its typecheck and tests.
2. Regenerate types from the final contract. Re-running `openapi-typescript` and then `git diff` shows whether anything drifted.
3. Drive the real flow in the browser (Playwright MCP from the frontend setup): sign up, use the feature, reload (the session should persist), sign out. Check the console and failed network requests.
4. Optional fresh eyes: `ui-reviewer` (frontend setup) for the UI and `api-security-reviewer` for the new endpoints.

## Frontend data layer (the frontend half)
- `openapi-fetch` client: `createClient<paths>({ baseUrl: "/" })`. It's same-origin through the proxy, so cookies are sent automatically.
- Put server state in TanStack Query (see the frontend `component-architecture` skill): queries keyed by resource, invalidate after mutations, and keep server data out of global stores.
- Auth state: `GET /api/auth/me` on load. 401 means signed out. Redirect to login when any call returns 401.
- Show `problem.detail` to users, and map `problem.errors[].path` to form fields.

## Deploying both halves
Serve the built frontend and the API from one origin (`/api/*` goes to the API), so cookie and CSRF settings stay exactly as in development. The `deploy` skill has the Caddy + Compose recipe, platform options, the release process, and the launch checklist.
