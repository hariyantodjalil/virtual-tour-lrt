# CMS inquiry editor

Mode: Operate.
Targets: `/cms/leads` (list) and `/cms/leads/[id]` (dedicated detail); `app/cms/leads/LeadsClient.tsx`, `LeadDetailClient.tsx`, `LeadWorkflowPanel.tsx`, `InquiryDocuments.tsx`.

## Direction

Light workspace for the entire CMS (`/cms`): match the predominantly white inquiry/detail modal. Use a very light gray canvas, white panels, dark slate text and restrained signal-red actions/selection. Semantic colors live in `.cms-light` on the shell `<main>` (globals.css). The CMS sidebar keeps the maroon identity: Dashboard is a direct link, the other function groups (Tur Virtual, Komersial, Pengajuan, Pengaturan) are accordion dropdowns — one open at a time, the active route's group opens automatically on navigation, and the collapsed icon rail shows all items separated by hairlines. Panorama preview chrome (`PannellumPreview.tsx`) deliberately keeps dark scrims over the photo canvas. Prioritize the next administrative task, not a simultaneous display of every form and all six milestone descriptions.

- Compact list of inquiry links. Opening an inquiry navigates to a dedicated page, never an accordion/dropdown editor. Use breadcrumb Pengajuan & Site Visit → inquiry code, plus a clear company/title header.
- Detail refresh must keep the existing workflow component mounted so field drafts survive document/status reloads. The list revalidates on browser Back without resetting local filters.
- Desktop: six-step navigation rail beside one selected milestone workspace.
- Mobile: compact Tahapan / Dokumen / Catatan navigation and a labeled native milestone selector.
- Show only the selected milestone's document requirements. Keep all documents, OTHER attachments and legacy links available in Semua dokumen.
- Put document evidence before milestone confirmation. Separate secondary saves from the single primary progression action.
- Keep site visit inside negotiation, PKS dates inside PKS, and payment verification inside activation.
- Keep contact/unit information and trainset allocation discoverable in separate disclosures below the editor. Do not remove operational allocation controls.
- Distinguish completed milestone, currently viewed milestone, and pending confirmation. Selecting a stage must never mutate status.

## State and safety

Preserve local field drafts across server refreshes, document operations, card collapse and list filtering. Warn before discarding a pending upload when changing editor scope. Block concurrent document/status mutations in the UI. Refresh verification locks when server status changes. Existing backend gates, permissions and private S3 access remain authoritative and unchanged.

## Verification

Use Responsively on desktop and mobile. Tests may use clearly labeled disposable local fixtures; never advance or alter real partner inquiries just to capture a screenshot. Check long names, missing PDFs, read-only access, stopped inquiries, keyboard focus, upload scope and draft retention. Keep credentials out of source and design artifacts.
