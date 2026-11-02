import type { Metadata } from "next";
import Link from "next/link";
import PetImageGallery from "./PetImageGallery";
type Pet = {
  id?: string;
  puppy_id?: string;
  category?: string;
  species?: string;
  breed?: string;
  name?: string;
  gender?: string;
  age?: string;
  age_weeks?: string | number;
  price?: string | number;
  price_inr?: string | number;
  status?: string;
  vaccinated?: string;
  location?: string;
  image?: string;
  photo?: string;
  images?: string[];
  gallery_1?: string;
  gallery_2?: string;
  gallery_3?: string;
  gallery_4?: string;
  gallery_5?: string;
  description?: string;
};
const SITE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://petora-ashen.vercel.app";
function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
/**
 * Keep full URLs unchanged.
 * Preserve folder paths for local public images.
 * Examples:
 * /ST001-images/ST001-1.jpg
 * ST001-images/ST001-1.jpg
 */
function getImageUrl(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const normalized = raw
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^images\//i, "");
  if (!normalized) return "";
  return `/${normalized
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/")}`;
}
function getPetImages(pet: Pet): string[] {
  const suppliedImages = Array.isArray(pet.images) ? pet.images : [];
  return [
    pet.image,
    pet.photo,
    ...suppliedImages,
    pet.gallery_1,
    pet.gallery_2,
    pet.gallery_3,
    pet.gallery_4,
    pet.gallery_5,
  ]
    .map(getImageUrl)
    .filter((image, index, all) => Boolean(image) && all.indexOf(image) === index);
}
function getPetId(pet: Pet): string {
  return clean(pet.id || pet.puppy_id);
}
async function getPets(): Promise<Pet[]> {
  const response = await fetch(`${SITE_URL}/api/pets`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`PETORA inventory request failed (${response.status})`);
  }
  const data: unknown = await response.json();
  if (Array.isArray(data)) {
    return data as Pet[];
  }
  if (
    data &&
    typeof data === "object" &&
    "pets" in data &&
    Array.isArray(data.pets)
  ) {
    return data.pets as Pet[];
  }
  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    Array.isArray(data.data)
  ) {
    return data.data as Pet[];
  }
  throw new Error("The PETORA inventory API returned an unexpected format.");
}
async function getPet(id: string): Promise<Pet | undefined> {
  const pets = await getPets();
  const requestedId = decodeURIComponent(id).trim().toLowerCase();
  return pets.find(
    (pet) => getPetId(pet).toLowerCase() === requestedId
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let pet: Pet | undefined;
  try {
    pet = await getPet(id);
  } catch {
    return {
      title: "PETORA Pet Listing",
      description: "Explore pet listings on PETORA.",
    };
  }
  if (!pet) {
    return {
      title: "Pet Not Found | PETORA™",
      description: "This PETORA pet listing could not be found.",
    };
  }
  const name = clean(pet.name || pet.breed) || "Pet";
  const breed = clean(pet.breed || pet.species) || "Pet";
  const location = clean(pet.location) || "India";
  const petId = getPetId(pet) || id;
  const image = getPetImages(pet)[0] || "";
  return {
    title: `${name} - ${breed} | PETORA™`,
    description: `View the PETORA listing for ${name}, ${breed} in ${location}. Check availability, age, vaccination information, price and enquiry options.`,
    alternates: {
      canonical: `/pets/${encodeURIComponent(petId)}`,
    },
    openGraph: {
      title: `${name} - ${breed} | PETORA™`,
      description: `Explore the ${name} ${breed} listing on PETORA™.`,
      url: `${SITE_URL}/pets/${encodeURIComponent(petId)}`,
      siteName: "PETORA™",
      type: "website",
      images: image
        ? [
            {
              url: image.startsWith("http")
                ? image
                : `${SITE_URL}${image}`,
              alt: `${name} - ${breed}`,
            },
          ]
        : undefined,
    },
  };
}
export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let pet: Pet | undefined;
  let inventoryError = false;
  try {
    pet = await getPet(id);
  } catch (error) {
    console.error("PETORA pet detail inventory error:", error);
    inventoryError = true;
  }
  if (inventoryError) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "80px 24px",
          background: "#f5f7f2",
          color: "#07513f",
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: 36,
            background: "#fff",
            borderRadius: 24,
          }}
        >
          <h1>Pet listings are temporarily unavailable</h1>
          <p>
            We could not load the PETORA inventory right now. Please try again
            shortly.
          </p>
          <Link href="/">← Back to PETORA</Link>
        </div>
      </main>
    );
  }
  if (!pet) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "80px 24px",
          background: "#f5f7f2",
          color: "#07513f",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: 48,
            background: "#fff",
            borderRadius: 28,
          }}
        >
          <h1>Pet not found</h1>
          <p>This listing could not be found in the current inventory.</p>
          <Link href="/">← Back to PETORA</Link>
        </div>
      </main>
    );
  }
  const name = clean(pet.name || pet.breed) || "PETORA Pet";
  const breed = clean(pet.breed || pet.species) || "Pet";
  const location = clean(pet.location) || "Not specified";
  const priceValue = clean(pet.price_inr || pet.price);
  const price = priceValue ? `₹${priceValue}` : "Contact PETORA";
  const images = getPetImages(pet);
  const petId = getPetId(pet) || id;
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 24px 80px",
        background: "#f5f7f2",
        color: "#07513f",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginBottom: 24,
            color: "#07513f",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← Back to PETORA
        </Link>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: 36,
            background: "#fff",
            borderRadius: 28,
            padding: 28,
          }}
        >
          <PetImageGallery images={images} alt={`${name} - ${breed}`} />
          <div style={{ padding: "16px 8px" }}>
            <p
              style={{
                color: "#b18324",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              PETORA LISTING
            </p>
            <h1
              style={{
                fontSize: "clamp(34px, 5vw, 52px)",
                lineHeight: 1.1,
                margin: "12px 0 10px",
              }}
            >
              {name}
            </h1>
            <h2 style={{ fontSize: 24, margin: "0 0 26px" }}>
              {breed}
            </h2>
            <p>
              {clean(pet.description) ||
                `Explore this ${breed} listing with PETORA.`}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 14,
                margin: "28px 0",
              }}
            >
              <strong>Gender: {clean(pet.gender) || "—"}</strong>
              <strong>
                Age: {clean(pet.age || pet.age_weeks) || "—"}
              </strong>
              <strong>Location: {location}</strong>
              <strong>
                Vaccinated: {clean(pet.vaccinated) || "—"}
              </strong>
              <strong>
                Status: {clean(pet.status) || "Verify stock"}
              </strong>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                marginBottom: 22,
              }}
            >
              {price}
            </div>
            <Link
              href={`/booking/${encodeURIComponent(petId)}`}
              style={{
                display: "inline-block",
                padding: "15px 22px",
                borderRadius: 12,
                background: "#07513f",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Book This Companion →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
