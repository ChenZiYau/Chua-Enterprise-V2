import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicListing } from "@/lib/shareListing";
import { PublicGallery } from "@/components/share/PublicGallery";
import { buildShareUrl, buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/share";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ propertySlug: string }>;
}): Promise<Metadata> {
  const { propertySlug } = await params;
  const listing = await getPublicListing(propertySlug);
  if (!listing) return { title: "Listing not found" };
  return {
    title: `${listing.name}${listing.location ? ` — ${listing.location}` : ""}`,
    description: listing.description || `Photos for ${listing.name}`,
  };
}

export default async function PropertySharePage({
  params,
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  const listing = await getPublicListing(propertySlug);
  if (!listing) notFound();

  const rooms = listing.rooms.map((r) => ({
    name: r.name,
    href: buildShareUrl(listing, { slug: r.slug }),
  }));
  const whatsAppHref = buildWhatsAppUrl(
    WHATSAPP_NUMBER,
    `Hi, I'm interested in ${listing.name}`,
  );

  return (
    <PublicGallery
      title={listing.name}
      location={listing.location}
      propertyType={listing.propertyType}
      description={listing.description}
      photos={listing.photos}
      rooms={rooms}
      whatsAppHref={whatsAppHref}
    />
  );
}
