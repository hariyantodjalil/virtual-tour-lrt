type SpaceSummary = {
  code: string;
  stationName: string;
  rows: { label: string; value: string; hint?: string | null }[];
  teamName: string;
  phone: string;
};

/** Opens the browser's PDF/print dialog. Values are inserted as text, never HTML. */
export function printSpaceSummary(summary: SpaceSummary): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  const doc = popup.document;
  doc.open();
  doc.write(`<!doctype html><html lang="id"><head><meta charset="utf-8">
    <title>Ringkasan unit</title><style>
    @page { margin: 20mm; }
    body { font: 14px/1.6 Arial, sans-serif; color: #101828; margin: 32px; }
    h1 { font-size: 26px; margin: 0; overflow-wrap: anywhere; }
    p { margin: 4px 0 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; vertical-align: top; padding: 12px 0; border-bottom: 1px solid #ddd; overflow-wrap: anywhere; }
    th { width: 36%; font-weight: normal; color: #475467; padding-right: 20px; }
    small { display: block; color: #475467; }
    footer { margin-top: 28px; color: #475467; }
    </style></head><body></body></html>`);
  doc.title = `Ringkasan ${summary.code}`;
  const heading = doc.createElement("h1");
  heading.textContent = summary.code;
  const station = doc.createElement("p");
  station.textContent = `Stasiun ${summary.stationName}`;
  const table = doc.createElement("table");
  for (const row of summary.rows) {
    const tr = table.insertRow();
    const th = doc.createElement("th");
    th.scope = "row";
    th.textContent = row.label;
    tr.append(th);
    const td = tr.insertCell();
    td.textContent = row.value;
    if (row.hint) {
      const hint = doc.createElement("small");
      hint.textContent = row.hint;
      td.append(hint);
    }
  }
  const footer = doc.createElement("footer");
  footer.textContent = `${summary.teamName} · ${summary.phone}`;
  doc.body.append(heading, station, table, footer);
  doc.close();
  popup.focus();
  popup.setTimeout(() => popup.print(), 150);
  return true;
}
