CREATE INDEX IF NOT EXISTS "stations_isActive_order_idx"
ON "stations"("isActive", "order");

CREATE INDEX IF NOT EXISTS "tenant_leads_userId_createdAt_idx"
ON "tenant_leads"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "tenant_leads_status_idx"
ON "tenant_leads"("status");

CREATE INDEX IF NOT EXISTS "tenant_leads_createdAt_idx"
ON "tenant_leads"("createdAt");

CREATE INDEX IF NOT EXISTS "visit_events_eventType_createdAt_idx"
ON "visit_events"("eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "visit_events_stationId_eventType_idx"
ON "visit_events"("stationId", "eventType");
