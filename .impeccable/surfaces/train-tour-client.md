# Train Tour viewer

Mode: Experience, with Operate controls for navigation and rental inquiries.

Scope: `app/train/[slug]/TrainTourClient.tsx`, `components/train/TrainTourPanel.tsx`, and `components/train/TrainRentalSpaceDetail.tsx`.

Preserve the actual station viewer's dark glass chrome, red action color, white detail panels, and existing typography. Use DB content for train identity, car/zone/scene location, fleet availability, and media. No fabricated photos, descriptions, quantities, or contacts.

Mobile uses the shared draggable bottom sheet for lists and details, content height for brief information, and an expanded sheet for forms. Desktop uses a right side panel and a wider inquiry dialog. Keep 44 px targets, readable body text, a persistent detail action, safe-area spacing, and visible panorama around navigation. Avoid repeated location badges and descriptive cards that restate a label or count.
