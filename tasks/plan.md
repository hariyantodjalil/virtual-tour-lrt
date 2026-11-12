# Train advertising inquiry flow

Train panoramas illustrate media locations. Partners request an advertising medium, not a carriage or numbered trainset. Full branding additionally accepts a requested trainset count. Staff assign numbered trainsets after checking operating condition and maintenance.

1. Add an additive, DB-backed inquiry contract and backfill identifiable legacy train leads. Preserve allocation catalogs and station leads.
2. Separate public media DTOs from internal fleet allocations. Validate both guest and partner submissions against the media's current inquiry mode/status. Reject partner-supplied allocation data.
3. Update viewer/detail/forms and CMS media configuration. Body Branding (08) starts as full branding, as confirmed by the user. Public capacity is CMS-maintained and never represents live stock.
4. Display train requests in partner cards/details and CMS leads. Staff-only allocation editing must never expose codes or allocation notes in partner responses.
5. Verify migrations and API flows in an isolated DB, owner isolation, duplicate prevention, legacy compatibility, and station regression. Check responsive UI with MCP Responsively, then lint/build. Do not commit or push.
