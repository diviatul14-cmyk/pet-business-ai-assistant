import type { MetadataRoute } from "next";

type Pet = {
  id?: string;
  puppy_id?: string;
  status?: string;
  image?: string;
  photo?: string;
};

const baseUrl = "https://petora-ashen.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    const response = await fetch(`${baseUrl}/api/pets`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return urls;
    }

    const pets: Pet[] = await response.json();

    const petUrls = pets
      .filter((pet) => {
        const id = pet.id || pet.puppy_id;
        const image = pet.image || pet.photo;
        const status = String(pet.status || "").toLowerCase();

        return (
          Boolean(id) &&
          Boolean(image) &&
          (status === "" ||
            status === "available" ||
            status === "active")
        );
      })
      .map((pet) => ({
        url: `${baseUrl}/pets/${encodeURIComponent(
          String(pet.id || pet.puppy_id)
        )}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));

    return [...urls, ...petUrls];
  } catch {
    return urls;
  }
}
