import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicRoomListing } from "@/lib/shareListing";
import { PublicGallery } from "@/components/share/PublicGallery";
import { buildShareUrl, buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/share";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ propertySlug: string; roomSlug: string }>;
}): Promise<Metadata> {
  const { propertySlug, roomSlug } = await params;
  const data = await getPublicRoomListing(propertySlug, roomSlug);
  if (!data) return { title: "Listing not found" };
  return {
    title: `${data.room.name} — ${data.property.name}`,
    description: `Photos for ${data.room.name} at ${data.property.name}`,
  };
}

export default async function RoomSharePage({
  params,
}: {
  params: Promise<{ propertySlug: string; roomSlug: string }>;
}) {
  const { propertySlug, roomSlug } = await params;
  const data = await getPublicRoomListing(propertySlug, roomSlug);
  if (!data) notFound();

  const { property, room, photos } = data;
  const whatsAppHref = buildWhatsAppUrl(
    WHATSAPP_NUMBER,
    `Hi, I'm interested in ${property.name} ${room.name}`,
  );

  return (
    <PublicGallery
      title={room.name}
      subtitle={property.name}
      location={property.location}
      propertyType={property.propertyType}
      photos={photos}
      whatsAppHref={whatsAppHref}
      backHref={{ href: buildShareUrl(property), label: property.name }}
    />
  );
}
