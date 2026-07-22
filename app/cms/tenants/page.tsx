import { prisma } from "@/lib/prisma";
import TenantsClient, {
  type SpaceOption,
  type StationOption,
  type TenantItem,
} from "./TenantsClient";

export const dynamic = "force-dynamic";

async function getTenantsPageData(): Promise<{
  tenants: TenantItem[];
  stations: StationOption[];
  spaces: SpaceOption[];
}> {
  try {
    const [tenants, stations, spaces] = await Promise.all([
      prisma.tenant.findMany({
        include: {
          station: { select: { id: true, name: true, slug: true } },
          occupancies: {
            include: {
              space: { select: { id: true, code: true, name: true, type: true, status: true } },
            },
          },
        },
        orderBy: [{ isActive: "desc" }, { brandName: "asc" }],
      }),
      prisma.station.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }),
      prisma.commercialSpace.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          status: true,
          stationId: true,
        },
        orderBy: [{ floor: "asc" }, { code: "asc" }],
      }),
    ]);

    return {
      tenants: tenants.map((tenant) => ({
        id: tenant.id,
        brandName: tenant.brandName,
        contactName: tenant.contactName,
        phone: tenant.phone,
        email: tenant.email,
        notes: tenant.notes,
        isActive: tenant.isActive,
        station: tenant.station,
        occupancies: tenant.occupancies.map((o) => ({
          id: o.id,
          spaceId: o.spaceId,
          space: {
            id: o.space.id,
            code: o.space.code,
            name: o.space.name,
            type: o.space.type,
            status: o.space.status,
          },
          startDate: o.startDate?.toISOString() ?? null,
          endDate: o.endDate?.toISOString() ?? null,
        })),
      })),
      stations,
      spaces: spaces.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        type: s.type,
        status: s.status,
        stationId: s.stationId,
      })),
    };
  } catch {
    return { tenants: [], stations: [], spaces: [] };
  }
}

export default async function CmsTenantsPage() {
  const { tenants, stations, spaces } = await getTenantsPageData();
  return (
    <TenantsClient
      initialTenants={tenants}
      initialStations={stations}
      initialSpaces={spaces}
    />
  );
}
