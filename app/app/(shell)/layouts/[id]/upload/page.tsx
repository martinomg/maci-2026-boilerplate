import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LayoutUploadForm } from "@/components/layout-upload/layout-upload-form";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { directusServerFetch } from "@/lib/directus-server";

export const metadata: Metadata = {
  title: "Upload layout",
  description: "Replace the SVG layout of a parking lot.",
};

type ParkingLot = {
  id: string;
  name: string;
  city: string | null;
  layout_svg: string | null;
};

export default async function UploadLayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let lot: ParkingLot;
  try {
    lot = await directusServerFetch<ParkingLot>(
      `/items/parking_lots/${encodeURIComponent(id)}`,
      { fields: "id,name,city,layout_svg" },
    );
  } catch {
    notFound();
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operations"
        title={`Upload layout · ${lot.name}`}
        description={
          lot.layout_svg
            ? "Publishing a new file replaces the layout this lot currently uses. The previous file stays in Directus."
            : "This lot has no layout yet. The first accepted file becomes its layout."
        }
        actions={
          <Badge variant="outline" className="font-mono text-[0.68rem] uppercase">
            #16
          </Badge>
        }
      />

      <LayoutUploadForm
        lotId={lot.id}
        lotName={lot.name}
        currentFileId={lot.layout_svg}
      />
    </PageContainer>
  );
}
