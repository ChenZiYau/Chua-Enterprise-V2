import "server-only";
import { getProperties, getUnits } from "@/lib/db";
import { roomSlug, splitGalleryUrls } from "@/lib/share";

// Server-only listing layer for the PUBLIC share pages. It deliberately maps
// the rich database rows down to a tiny, safe shape. Nothing here exposes
// revenue, expenses, tenant identities, or occupancy — only what a prospective
// customer should see: name, location, photos, and basic specs.

export type PublicRoom = {
  slug: string;
  name: string;
};

export type PublicListing = {
  slug: string;
  name: string;
  /** "City, State" — never the full street address. */
  location: string;
  rentalModel: "room_rental" | "whole_unit";
  propertyType: string;
  description: string;
  /** All available photo URLs (hero first). */
  photos: string[];
  /** Empty for whole-unit listings. */
  rooms: PublicRoom[];
};

export type PublicRoomListing = {
  property: PublicListing;
  room: PublicRoom;
  /** Room photos if available, otherwise the property photos. */
  photos: string[];
};

function locationOf(city: string, state: string): string {
  return [city, state].filter(Boolean).join(", ");
}

/** Fetch and build every public listing (used by the listing API). */
export async function getPublicListings(): Promise<PublicListing[]> {
  const [props, units] = await Promise.all([getProperties(), getUnits()]);
  return props
    .filter((p) => p.status !== "inactive")
    .map((p) => buildListing(p, units));
}

/** Resolve a single property listing by its public slug. */
export async function getPublicListing(slug: string): Promise<PublicListing | null> {
  const [props, units] = await Promise.all([getProperties(), getUnits()]);
  const p = props.find((x) => (x.slug || x.id) === slug && x.status !== "inactive");
  if (!p) return null;
  return buildListing(p, units);
}

/** Resolve a single room within a property by both slugs. */
export async function getPublicRoomListing(
  propertySlug: string,
  roomSlugParam: string,
): Promise<PublicRoomListing | null> {
  const [props, units] = await Promise.all([getProperties(), getUnits()]);
  const p = props.find((x) => (x.slug || x.id) === propertySlug && x.status !== "inactive");
  if (!p) return null;
  const propertyUnits = units.filter((u) => u.property === p.name);
  const unit = propertyUnits.find((u) => roomSlug(u) === roomSlugParam);
  if (!unit) return null;

  const property = buildListing(p, units);
  const roomPhotos = splitGalleryUrls(unit.galleryUrls);
  return {
    property,
    room: { slug: roomSlug(unit), name: unit.name },
    photos: roomPhotos.length ? roomPhotos : property.photos,
  };
}

type PropertyRowLite = Awaited<ReturnType<typeof getProperties>>[number];
type UnitRowLite = Awaited<ReturnType<typeof getUnits>>[number];

function buildListing(p: PropertyRowLite, allUnits: UnitRowLite[]): PublicListing {
  const isRoom = p.rentalModel === "room_rental";
  const rooms: PublicRoom[] = isRoom
    ? allUnits
        .filter((u) => u.property === p.name)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((u) => ({ slug: roomSlug(u), name: u.name }))
    : [];
  return {
    slug: p.slug || p.id,
    name: p.name,
    location: locationOf(p.city, p.state),
    rentalModel: isRoom ? "room_rental" : "whole_unit",
    propertyType: p.propertyType || "",
    description: p.description || "",
    photos: splitGalleryUrls(p.imageUrl, p.galleryUrls),
    rooms,
  };
}
