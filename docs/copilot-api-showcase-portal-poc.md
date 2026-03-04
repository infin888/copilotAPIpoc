# Copilot API Showcase Portal (POC Plan)

## 1) Purpose and constraints

This POC demonstrates all Copilot API subsets in a **single web portal** while preserving Microsoft 365 security boundaries (identity, permissions, policy trimming, and sensitivity labeling).

### API surface and stability assumptions
- Endpoints are under:
  - `https://graph.microsoft.com/v1.0/copilot`
  - `https://graph.microsoft.com/beta/copilot`
- Several endpoints are `/beta` and **preview/non-production**.
- Authentication and authorization follow standard Microsoft Graph + Entra ID OAuth.

### Operational assumptions
- Users of Copilot functionality need Microsoft 365 Copilot licensing.
- Microsoft 365 E3/E5 (or equivalent) underpins dependent data/services.

---

## 2) Product concept

Build one web app: **Copilot API Showcase Portal**.

### Role model
- **User**: Chat, Search, Retrieval, Meeting Insights
- **Admin / Compliance**: Interaction Export, Change Notifications, Usage Reports, Package Management

### UX shell
- Left nav modules:
  - Chat
  - Search
  - Retrieval (RAG)
  - Meeting Insights
  - Compliance Export
  - Real-time Audit Feed
  - Adoption Reports
  - Package Catalog
- Top bar:
  - signed-in user
  - tenant
  - role badges
- Global **Call Inspector** drawer on every module:
  - Graph endpoint
  - request payload
  - scopes used
  - redacted response

---

## 3) Reference architecture

### Frontend
- React or Next.js SPA
- MSAL sign-in (Auth Code + PKCE)
- UI calls backend only (BFF pattern)

### Backend
- Node.js (Express) or .NET minimal API
- Responsibilities:
  1. Delegated Graph calls via OBO flow for user-facing modules
  2. App-only Graph calls (Client Credentials) for compliance/admin modules
  3. Graph webhook endpoints + optional resource decryption pipeline
  4. SSE/WebSocket fanout to UI for live notifications

### Storage (minimal)
- SQLite (file) for POC (or Azure Table/Cosmos if cloud-native)
- Persist:
  - subscriptions metadata
  - raw/decrypted notifications
  - cached export pages
  - optional reports snapshots

### Hosting
- Azure App Service (container) or Azure Container Apps
- Public HTTPS callback required for Graph change notifications

---

## 4) Module-by-module build plan

## A) Chat module (preview)
**Goal:** conversational interface using Copilot chat APIs with optional streaming + grounding controls.

### Endpoints
- `POST /beta/copilot/conversations`
- `POST /beta/copilot/conversations/{conversationId}/chat`
- `POST /beta/copilot/conversations/{conversationId}/chatOverStream` (`text/event-stream`)

### UI capabilities
- conversation list + create conversation
- prompt composer with:
  - stream on/off
  - contextual file attachments
  - additional context notes
- response rendering:
  - text
  - citations/grounding metadata (if present)
  - latency/progress instrumentation

### Notable request fields
- `locationHint` (required for chat calls)
- `additionalContext`
- `contextualResources`

### Permissions
- Delegated only (work/school)
- Include documented scope bundle for chat to reduce partial failures

---

## B) Search module (preview)
**Goal:** natural language search over OneDrive/SharePoint with filtering, metadata, paging, batching.

### Endpoint
- `POST /beta/copilot/search`

### Demos
1. Basic query + hits (`totalCount`, `searchHits`, `preview`, `webUrl`)
2. Path filter + metadata selection
3. Paging via `@odata.nextLink`
4. Batch search via `POST /beta/$batch` (up to 20 search requests)

### Permissions
- Delegated only
- `Files.Read.All`, `Sites.Read.All` minimum

---

## C) Retrieval module
**Goal:** secure grounding retrieval for RAG pipelines.

### Endpoint
- `POST /v1.0/copilot/retrieval` (also in beta)

### Request parameters to expose
- `queryString` (<= 5000 chars)
- `dataSource`: `sharePoint` | `oneDrive` | `externalItem`
- `maximumNumberOfResults` (1-50)
- `filterExpression` (KQL)
- `resourceMetadataNames`

### Response fields to emphasize
- `resourceType`, `webUrl`, `extracts`
- `sensitivityLabelId`, `sensitivityLabelDisplayName`
- `relevanceScore` (sortable)

### “Wow” flow
1. Run Retrieval
2. Click “Send to custom model” to show RAG composition path

### Permissions
- Delegated only
- Files/Sites scopes; `ExternalItem.Read.All` if external items used

---

## D) Meeting Insights module
**Goal:** retrieve AI-generated meeting notes/action items.

### Endpoints
- `GET /v1.0/copilot/users/{userId}/onlineMeetings/{onlineMeetingId}/aiInsights`
- `GET /v1.0/copilot/users/{userId}/onlineMeetings/{onlineMeetingId}/aiInsights/{aiInsightId}`

### UI
- meeting picker (paste ids first; optional helper listing recent meetings)
- insight details:
  - meeting notes
  - action items (`ownerDisplayName`)
  - mention events when available

### Constraints
- `OnlineMeetingAiInsight.Read.All`
- Meeting must not be expired

---

## E) Compliance Export module
**Goal:** export enterprise Copilot interactions for compliance workflows.

### Endpoint
- `GET /v1.0/copilot/users/{id}/interactionHistory/getAllEnterpriseInteractions`

### Demos
- app-only access path
- `$top`, `$filter` controls
- timeline grouped by `sessionId` / `requestId`
- export JSON / CSV

### Constraints
- Delegated not supported
- App permission: `AiEnterpriseInteraction.Read.All`
- No delta support
- Copilot Studio agent interactions excluded

---

## F) Real-time Audit Feed (preview)
**Goal:** near real-time interaction monitoring via Graph subscriptions.

### Subscription resources
- per-user: `/copilot/users/{user-id}/interactionHistory/getAllEnterpriseInteractions`
- tenant-wide: `/copilot/interactionHistory/getAllEnterpriseInteractions`

### Backend flow
1. Create subscription: `POST /v1.0/subscriptions`
2. Receive notifications at `notificationUrl`
3. Validate `clientState`
4. Decrypt (if resource data included)
5. Persist and stream to frontend

### Key platform rules
- If expiration is >1 hour, `lifecycleNotificationUrl` required
- `$filter` only supports top-level `aiInteraction` fields

### Permissions
- per-user: delegated `AiEnterpriseInteraction.Read` or app alternatives
- tenant-wide: app `AiEnterpriseInteraction.Read.All`

### UI
- start/renew subscription
- live event grid
- filter toggles
- deep links to context references

---

## G) Adoption Analytics module
**Goal:** show Copilot adoption and activity trends.

### Endpoints
- `GET /v1.0/copilot/reports/getMicrosoft365CopilotUserCountSummary(period='D7')`
- `GET /v1.0/copilot/reports/getMicrosoft365CopilotUserCountTrend(period='D7')`
- `GET /v1.0/copilot/reports/getMicrosoft365CopilotUsageUserDetail(period='D7')`

### UI
- period selector (`D7`, `D30`, `D90`, `D180`, `ALL`)
- charts: enabled vs active, trend line
- per-user table by workload/app

### Permissions and role caveats
- `Reports.Read.All` required
- Delegated access requires qualifying Entra admin role
- Per-user prompt counts and unlicensed chat usage are not returned

---

## H) Package Catalog module (preview)
**Goal:** inventory agents/apps and inspect package-level details.

### Endpoints
- `GET /beta/copilot/admin/catalog/packages`
- `GET /beta/copilot/admin/catalog/packages/{id}`

### UI
- list + filter (`supportedHosts`, `elementTypes`, `lastModifiedDateTime`)
- detail pane (version, categories, deployment, allowed users/groups, element metadata)

### Permissions
- Delegated only
- `CopilotPackages.Read.All` (or read/write variant)

---

## 5) Auth and permissions strategy

Use two modes in one solution.

### Delegated mode (OBO)
Used by: Chat, Search, Retrieval, Meeting Insights, Package Catalog.

### App-only mode (Client Credentials)
Used by: Interaction Export, tenant-wide notifications (optionally reports).

### POC permission matrix (config-driven)
- Chat: delegated scope bundle documented by API
- Search: `Files.Read.All`, `Sites.Read.All` (delegated)
- Retrieval: Files/Sites delegated + optional `ExternalItem.Read.All`
- Meeting Insights: `OnlineMeetingAiInsight.Read.All` (delegated)
- Interaction Export: `AiEnterpriseInteraction.Read.All` (application)
- Change Notifications:
  - per-user: delegated `AiEnterpriseInteraction.Read` or app equivalents
  - tenant-wide: app `AiEnterpriseInteraction.Read.All`
- Reports: `Reports.Read.All` (delegated or app)
- Package catalog: `CopilotPackages.Read.All` (delegated)

---

## 6) Demo script (end-to-end)

### Persona 1: standard user
1. Run Search for a business query and show metadata + paging
2. Run Retrieval for same query and compare outputs + sensitivity labels
3. Use Chat with streaming and contextual grounding
4. Open Meeting Insights and show notes/action items

### Persona 2: admin/compliance
1. Start filtered Change Notification subscription and show live updates
2. Run Interaction Export and download JSON/CSV
3. Open Adoption Analytics (D30 summary/trend/user detail)
4. Open Package Catalog and drill into package details

---

## 7) Delivery sequencing

### Phase 0: tenant/app readiness
- validate licensing + prerequisites
- create app registrations for delegated and app-only flows

### Phase 1: user-facing baseline
- Search + Retrieval first
- Chat sync then stream

### Phase 2: meeting intelligence
- meeting selection helper + aiInsights views

### Phase 3: compliance
- Interaction Export
- subscriptions + webhook + live feed

### Phase 4: admin analytics/catalog
- usage reports visuals
- package inventory + drill-down
