"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Lead = {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  businessType: string;
  status: string;
  createdAt: string;
  space: { code: string; station: { name: string } } | null;
};

const STATUSES = ["NEW", "CONTACTED", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"];

export default function CmsLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  async function load() {
    const res = await fetch("/api/cms/leads");
    setLeads(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/cms/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Leads Tenant</h1>
      <div className="space-y-3">
        {leads.map((lead) => (
          <Card key={lead.id} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{lead.companyName}</p>
                  <p className="text-sm text-slate-400">{lead.contactName} · {lead.phone} · {lead.email}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {lead.space ? `${lead.space.station.name} — ${lead.space.code}` : "Tanpa unit spesifik"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{new Date(lead.createdAt).toLocaleString("id-ID")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{lead.status}</Badge>
                  <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                    <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {leads.length === 0 && <p className="text-slate-400">Belum ada leads.</p>}
      </div>
    </div>
  );
}
