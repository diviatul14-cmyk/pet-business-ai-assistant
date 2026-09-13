"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Pet = {
  id: string;
  category: string;
  breed: string;
  name: string;
  gender: string;
  age: string;
  price: string;
  status: string;
  location: string;
  image: string;
  description: string;
};

const CATEGORY_MAP: Record<string, string> = {
  dogs: "Dogs",
  cats: "Cats",
  aquatics: "Aquatics",
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function imagePath(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  const fileName = raw.split("/").pop() ?? "";
  return fileName ? `/${fileName}` : "";
}

function money(value: string): string {
  const numeric = Number(value.replace(/[₹,$,\s]/g, ""));
  if (!Number.isFinite(numeric)) return value || "Price on enquiry";
  return `₹${numeric.toLocaleString("en-IN")}`;
}

function isAvailable(status: string): boolean {
  return status.trim().toLowerCase() === "available";
}

export default function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const requested = clean(params.category).toLowerCase();
  const categoryName = CATEGORY_MAP[requested] || "";

  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/pets", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Inventory request failed.");
        }

        const data = await response.json();

        const normalized = Array.isArray(data)
          ? data.map((item: any) => ({
              id: clean(item?.id ?? item?.pet_id ?? item?.puppy_id),
              category: clean(item?.category),
              breed: clean(item?.breed),
              name: clean(item?.name) || clean(item?.breed),
              gender: clean(item?.gender),
              age: clean(item?.age ?? item?.age_weeks),
              price: clean(item?.price),
              status: clean(item?.status),
              location: clean(item?.location),
              image: imagePath(item?.image ?? item?.photo),
              description: clean(item?.description),
            }))
          : [];

        if (!cancelled) {
          setPets(normalized);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load this PETORA category right now.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryPets = useMemo(
    () =>
      pets.filter(
        (pet) =>
          pet.category.toLowerCase() === categoryName.toLowerCase() &&
          Boolean(pet.image)
      ),
    [pets, categoryName]
  );

  if (!categoryName) {
    return (
      <main className="category-page">
        <div className="category-page-inner">
          <span className="eyebrow">PETORA</span>
          <h1>Category not found</h1>
          <p>Please return to the PETORA home page.</p>
          <Link href="/" className="primary-button">
            Back to PETORA →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="category-page">
      <div className="category-page-inner">
        <div className="category-page-top">
          <Link href="/" className="category-back-link">
            ← PETORA Home
          </Link>
        </div>

        <header className="category-page-heading">
          <span className="eyebrow">
            {categoryName === "Dogs"
              ? "DOGS • COMPANIONS"
              : categoryName === "Cats"
                ? "CATS • FELINE FRIENDS"
                : "AQUATICS • FISH & AROWANA"}
          </span>

          <h1>{categoryName}</h1>

          <p>
            {categoryName === "Dogs"
              ? "Discover PETORA dog companions."
              : categoryName === "Cats"
                ? "Discover PETORA cat companions."
                : "Explore marine fish, freshwater fish and premium Arowana."}
          </p>

          <div className="category-page-count">
            {categoryPets.length} listings
          </div>
        </header>

        {loading && (
          <div className="category-page-state">
            Loading PETORA listings...
          </div>
        )}

        {!loading && error && (
          <div className="category-page-state">
            {error}
          </div>
        )}

        {!loading && !error && categoryPets.length === 0 && (
          <div className="category-page-state">
            No photographed listings are available in this category yet.
          </div>
        )}

        {!loading && !error && categoryPets.length > 0 && (
          <div className="category-products-grid">
            {categoryPets.map((pet) => (
              <article key={pet.id} className="category-product-card">
                <div className="category-product-image-wrap">
                  <img
                    src={pet.image}
                    alt={`${pet.name} - ${pet.breed}`}
                    className="category-product-image"
                  />

                  <span
                    className={
                      isAvailable(pet.status)
                        ? "category-product-status available"
                        : "category-product-status preorder"
                    }
                  >
                    {isAvailable(pet.status) ? "✓ Available" : "PRE-ORDER"}
                  </span>
                </div>

                <div className="category-product-body">
                  <span className="pet-category">
                    {pet.category}
                  </span>

                  <h2>{pet.name}</h2>

                  <p className="category-product-breed">
                    {pet.breed} · {pet.id}
                  </p>

                  <div className="category-product-meta">
                    {pet.age && <span>{pet.age}</span>}
                    {pet.location && <span>{pet.location}</span>}
                  </div>

                  <strong className="category-product-price">
                    {money(pet.price)}
                  </strong>

                  <Link
                    href={`/pets/${pet.id}`}
                    className="category-product-button"
                  >
                    View Details →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
