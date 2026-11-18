# Train Tour responsive viewer

The train viewer follows the station viewer's dark glass controls and white content panels. Panorama interaction remains the primary surface.

- The breadcrumb reads the train, car, zone, and scene from the public DB-backed tour structure. There is no separate active-car badge at the top.
- Car navigation and the media catalog use touch-sized list buttons. Selecting a car changes the panorama; selecting media opens its detail with the current car as context.
- On screens below 768 px, lists and media details use the shared bottom sheet: expand/collapse handle, swipe dismissal, slide entrance/exit, safe-area footer, focus management, and reduced-motion support. Information panels fit their content. Application forms open expanded.
- Tablet and desktop use a white side panel. Application forms have a wider dialog, with two columns from 1024 px and one scroll area on smaller screens.
- Media detail shows the actual status, car availability, description, ordering instructions, and photo. Missing descriptions are omitted and missing photos remain neutral. The application action requires availability in the selected car.
- The existing application payload and form are retained. Trainset quantity and car count come from the fleet catalog, including fleets with a different number of cars. Commercial contact comes from the CMS profile.
- Outer viewer controls hide while a panel is open. On short viewports, the train tool rail becomes horizontal to keep it clear of the header.

Verification uses MCP Responsively at 320, 390, 768, and 1440 px. Car navigation, media selection, unavailable media, and application selection are checked. An isolated local database supplies an available media item with a custom car and trainset for form checks; it is removed afterward. No application is submitted through the browser and no original fleet or media record is changed.

Physical phone gestures, virtual keyboard behavior, and Google authentication require a device check beyond Responsively's emulation.
