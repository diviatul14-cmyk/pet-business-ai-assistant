"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ApiPet = {
  id?: string;
  puppy_id?: string;
  pet_id?: string;
  category?: string;
  species?: string;
  breed?: string;
  name?: string;
  gender?: string;
  age?: string;
  age_weeks?: string | number;
  price?: string | number;
  status?: string;
  vaccinated?: string;
  location?: string;
  image?: string;
  photo?: string;
  description?: string;
};

type Pet = {
  id: string;
  category: string;
  species: string;
  breed: string;
  name: string;
  gender: string;
  age: string;
  price: string;
  status: string;
  vaccinated: string;
  location: string;
  image: string;
  description: string;
};

type Product = {
  product_id: string;
  category: string;
  subcategory: string;
  product_name: string;
  brand: string;
  price: string;
  mrp: string;
  stock: string;
  unit: string;
  image: string;
  description: string;
  status: string;
};

const categoryCards = [
  {
    title: "Dogs",
    subtitle: "Puppies & companions",
    image:
      "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Cats",
    subtitle: "Feline friends",
    image:
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Aquatics",
    subtitle: "Fish",
    image:
      "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "",
    subtitle: "Unique companions",
    image:
      "https://images.unsplash.com/photo-1504457047772-27faf1c00561?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Exotic Pets",
    subtitle: "Extraordinary companions",
    image:
      "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=1400&q=85",
  },
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function imagePath(value: unknown): string {
  const raw = clean(value);

  if (!raw) {
    return "";
  }

  // Already a browser-ready URL.
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  // A path such as images/ST001.jpg becomes /ST001.jpg
  const fileName = raw.split("/").pop() ?? "";

  return fileName ? `/${fileName}` : "";
}

function categoryFromPet(pet: ApiPet): string {
  const category = clean(pet.category).toLowerCase();
  const species = clean(pet.species).toLowerCase();
  const breed = clean(pet.breed).toLowerCase();

  if (
    category === "dog" ||
    category === "dogs" ||
    species === "dog" ||
    species === "dogs" ||
    breed.includes("shih tzu") ||
    breed.includes("german shepherd")
  ) {
    return "Dogs";
  }

  if (
    category === "cat" ||
    category === "cats" ||
    species === "cat" ||
    species === "cats"
  ) {
    return "Cats";
  }

  if (
    category.includes("aquatic") ||
    category.includes("fish") ||
    species.includes("aquatic") ||
    species.includes("fish")
  ) {
    return "Aquatics";
  }

  if (
    category.includes("reptile") ||
    species.includes("reptile")
  ) {
    return "";
  }

  if (
    category.includes("exotic") ||
    species.includes("exotic")
  ) {
    return "Exotic Pets";
  }

  return clean(pet.category) || "Pets";
}

function normalizePet(pet: ApiPet): Pet {
  const id = clean(
    pet.id ??
      pet.pet_id ??
      pet.puppy_id
  );

  const breed = clean(pet.breed);

  const name =
    clean(
      pet.name ??
        ""
    ) ||
    breed ||
    id ||
    "PETORA Pet";

  const age = clean(
    pet.age ??
      pet.age_weeks
  );

  return {
    id,
    category: categoryFromPet(pet),
    species: clean(pet.species),
    breed,
    name,
    gender: clean(pet.gender),
    age,
    price: clean(pet.price),
    status: clean(pet.status),
    vaccinated: clean(pet.vaccinated),
    location: clean(pet.location),
    image: imagePath(
      pet.image ??
        pet.photo
    ),
    description: clean(
      pet.description
    ),
  };
}

function isAvailable(pet: Pet): boolean {
  const status =
    pet.status.toLowerCase();

  return (
    status !== "sold" &&
    status !== "unavailable" &&
    status !== "out of stock"
  );
}

function money(value: string): string {
  const numeric = Number(
    value.replace(/[₹,$,\s]/g, "")
  );

  if (!Number.isFinite(numeric)) {
    return value || "Price on enquiry";
  }

  return `₹${numeric.toLocaleString(
    "en-IN"
  )}`;
}

export default function Home() {
  const [pets, setPets] = useState<Pet[]>(
    []
  );

  const [products, setProducts] = useState<Product[]>([]);

  const [productsLoading, setProductsLoading] =
    useState(true);

  const [productsError, setProductsError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [inventoryError, setInventoryError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("All");

  const [selectedPetId, setSelectedPetId] =
    useState("");

  const [formMessage, setFormMessage] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [aiQuestion, setAiQuestion] =
    useState("");

  const [aiAnswer, setAiAnswer] =
    useState(
      "Hello! I’m PETORA AI. Ask me about available pets, prices, pet IDs or availability."
    );

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      try {
        setLoading(true);
        setInventoryError("");

        const response =
          await fetch("/api/pets", {
            cache: "no-store",
          });

        if (!response.ok) {
          throw new Error(
            `Inventory request failed with status ${response.status}`
          );
        }

        const data: unknown =
          await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            "The PETORA inventory API did not return an array."
          );
        }

        const normalized: Pet[] =
          data
            .filter(
              (
                item
              ): item is Record<
                string,
                unknown
              > =>
                Boolean(item) &&
                typeof item ===
                  "object"
            )
            .map(
              (item) =>
                normalizePet(
                  item as ApiPet
                )
            )
            .filter(
              (pet) => pet.id
            );

        if (!cancelled) {
          setPets(normalized);

          console.log(
            "PETORA inventory loaded:",
            normalized
          );
        }
      } catch (error) {
        console.error(
          "PETORA inventory error:",
          error
        );

        if (!cancelled) {
          setPets([]);

          setInventoryError(
            "Unable to load the PETORA inventory right now."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setProductsLoading(true);
        setProductsError("");

        const response = await fetch("/api/products", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Products request failed with status ${response.status}`
          );
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            "The PETORA products API did not return an array."
          );
        }

        const normalized: Product[] = data
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) &&
              typeof item === "object"
          )
          .map((item) => ({
            product_id: clean(item.product_id),
            category: clean(item.category),
            subcategory: clean(item.subcategory),
            product_name: clean(item.product_name),
            brand: clean(item.brand),
            price: clean(item.price),
            mrp: clean(item.mrp),
            stock: clean(item.stock),
            unit: clean(item.unit),
            image: clean(item.image),
            description: clean(item.description),
            status: clean(item.status),
          }))
          .filter(
            (product) =>
              product.product_id &&
              product.product_name &&
              product.status.toLowerCase() === "available" &&
              Number(product.stock) > 0
          );

        if (!cancelled) {
          setProducts(normalized);
          console.log("PETORA products loaded:", normalized);
        }
      } catch (error) {
        console.error("PETORA products error:", error);

        if (!cancelled) {
          setProducts([]);
          setProductsError(
            "Unable to load PETORA products right now."
          );
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const goTo = (
    id: string
  ) => {
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  /*
   * IMPORTANT:
   * A marketplace card exists only when an actual image
   * is available.
   *
   * Your current inventory has:
   * ST001 -> /ST001.jpg
   * ST002 -> /ST002.jpg
   * GS001 -> /GS001.jpg
   */
  const photographedPets =
    useMemo(() => {
      return pets.filter(
        (pet) =>
          Boolean(
            clean(pet.image)
          )
      );
    }, [pets]);

  const availablePets =
    useMemo(() => {
      return photographedPets.filter(
        isAvailable
      );
    }, [photographedPets]);

  const filteredPets =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      const selected =
        category
          .trim()
          .toLowerCase();

      return availablePets.filter(
        (pet) => {
          const id =
            pet.id.toLowerCase();

          const breed =
            pet.breed.toLowerCase();

          const name =
            pet.name.toLowerCase();

          const location =
            pet.location.toLowerCase();

          const petCategory =
            pet.category.toLowerCase();

          const categoryMatch =
            selected === "" ||
            selected === "all" ||
            selected === "all pets" ||
            selected ===
              petCategory ||
            (
              selected === "dogs" &&
              petCategory ===
                "dogs"
            );

          const searchMatch =
            query === "" ||
            id.includes(query) ||
            breed.includes(query) ||
            name.includes(query) ||
            location.includes(query) ||
            petCategory.includes(
              query
            );

          return (
            categoryMatch &&
            searchMatch
          );
        }
      );
    }, [
      availablePets,
      search,
      category,
    ]);

  const selectedPet =
    pets.find(
      (pet) =>
        pet.id === selectedPetId
    );

  function choosePet(pet: Pet) {
    setSelectedPetId(
      pet.id
    );

    setFormMessage("");

    goTo("contact");

    window.setTimeout(() => {
      document
        .getElementById("contact-name")
        ?.focus();
    }, 500);
  }

  async function submitEnquiry(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSubmitting(true);
    setFormMessage("");

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    const payload = {
      name: clean(
        formData.get(
          "name"
        )
      ),

      phone: clean(
        formData.get(
          "phone"
        )
      ),

      pet_id: clean(
        formData.get(
          "pet_id"
        )
      ),

      message: clean(
        formData.get(
          "message"
        )
      ),
    };

    try {
      const response =
        await fetch(
          "/api/pets",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              payload
            ),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to submit enquiry."
        );
      }

      setFormMessage(
        "Your PETORA enquiry has been submitted successfully."
      );

      form.reset();
      setSelectedPetId("");
    } catch (error) {
      console.error(
        "PETORA enquiry submission error:",
        error
      );

      setFormMessage(
        "We could not submit the enquiry right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function askAI() {
    const question =
      aiQuestion
        .trim()
        .toLowerCase();

    if (!question) {
      return;
    }

    const matchedPet =
      availablePets.find(
        (pet) =>
          question.includes(
            pet.id.toLowerCase()
          ) ||
          (
            pet.breed &&
            question.includes(
              pet.breed.toLowerCase()
            )
          ) ||
          (
            pet.name &&
            question.includes(
              pet.name.toLowerCase()
            )
          )
      );

    if (
      question.includes(
        "available"
      ) ||
      question.includes(
        "availability"
      )
    ) {
      if (
        availablePets.length === 0
      ) {
        setAiAnswer(
          "There are no photographed available listings right now."
        );
      } else {
        const breeds =
          Array.from(
            new Set(
              availablePets
                .map(
                  (pet) =>
                    pet.breed
                )
                .filter(Boolean)
            )
          );

        setAiAnswer(
          `PETORA currently has ${availablePets.length} photographed available listing${
            availablePets.length === 1
              ? ""
              : "s"
          }. Breeds: ${breeds.join(
            ", "
          )}.`
        );
      }

      return;
    }

    if (
      question.includes(
        "price"
      ) ||
      question.includes(
        "cost"
      )
    ) {
      if (matchedPet) {
        setAiAnswer(
          `${matchedPet.id} – ${matchedPet.name} (${matchedPet.breed}) is listed at ${money(
            matchedPet.price
          )}.`
        );
      } else {
        setAiAnswer(
          "Tell me a pet ID such as ST001, ST002 or GS001 and I’ll show the current listed price."
        );
      }

      return;
    }

    if (
      question.includes(
        "breed"
      ) ||
      question.includes(
        "dog"
      )
    ) {
      const breeds =
        Array.from(
          new Set(
            availablePets
              .map(
                (pet) =>
                  pet.breed
              )
              .filter(Boolean)
          )
        );

      setAiAnswer(
        breeds.length
          ? `Currently available breeds: ${breeds.join(
              ", "
            )}.`
          : "No photographed breeds are currently available."
      );

      return;
    }

    if (
      question.includes(
        "st001"
      ) ||
      question.includes(
        "st002"
      ) ||
      question.includes(
        "gs001"
      )
    ) {
      if (matchedPet) {
        setAiAnswer(
          `${matchedPet.id} – ${matchedPet.name}. ${matchedPet.breed}. ${money(
            matchedPet.price
          )}. Located in ${matchedPet.location}.`
        );
      } else {
        setAiAnswer(
          "That pet is not currently available."
        );
      }

      return;
    }

    setAiAnswer(
      "I can help with current pet availability, breed, price, pet ID and location. Try asking about ST001, ST002 or GS001."
    );
  }

  return (
    <main className="petora-site">

      {/* =========================
          TOP BAR
      ========================= */}
      <div className="top-strip">
        <span>
          PETORA™
        </span>

        <span>
          Pets Beyond Borders
        </span>
      </div>

      {/* =========================
          HEADER
      ========================= */}
      <header className="site-header">

        <div className="header-brand">
          <img
            src="/petora-logo.png"
            alt="PETORA - Pets Beyond Borders"
          />

          <div>
            <strong>
              PETORA™
            </strong>

            <span>
              Pets Beyond Borders
            </span>
          </div>
        </div>

        <nav className="main-nav">
          <button
            type="button"
            onClick={() =>
              goTo("home")
            }
          >
            Home
          </button>

          <button
            type="button"
            onClick={() =>
              goTo("pets")
            }
          >
            Pets
          </button>
      <button
        type="button"
        onClick={() => goTo("shop")}
      >
        Shop
      </button>

          <button
            type="button"
            onClick={() =>
              goTo("categories")
            }
          >
            Categories
          </button>

          <button
            type="button"
            onClick={() =>
              goTo("contact")
            }
          >
            Contact
          </button>
        </nav>

        <button
          type="button"
          className="header-ai-button"
          onClick={() =>
            goTo("ai")
          }
        >
          PETORA AI
        </button>
      </header>

      {/* =========================
          HERO
      ========================= */}
      <section
        id="home"
        className="hero-section"
      >
        <div className="hero-copy">

          <span className="eyebrow">
            PETS BEYOND BORDERS
          </span>

          <h1>
            Different Pets.
            <br />
            Same Love.
          </h1>

          <p>
            Discover available companions,
            explore clear pet information,
            and connect with PETORA through
            a simple digital experience.
          </p>

          <div className="hero-actions">

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                goTo("pets")
              }
            >
              Explore Pets →
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                goTo("categories")
              }
            >
              Explore Categories
            </button>

          </div>

          <div className="hero-points">
            <span>
              ✓ Clear information
            </span>

            <span>
              ✓ Real listings
            </span>

            <span>
              ✓ AI-assisted guidance
            </span>
          </div>
        </div>

        <div className="hero-visual">

          <img
            src="/petora-logo.png"
            alt="PETORA"
            className="hero-logo"
          />

          <div className="hero-caption">
            <strong>
              More Pets.
            </strong>

            <span>
              A Wilder World.
            </span>
          </div>
        </div>
      </section>

      {/* =========================
          CATEGORY DISCOVERY
      ========================= */}
      

<div className="petora-commerce-columns">

  {/* =====================================================
      LEFT — SHOP BY PET
      ===================================================== */}
  <section id="categories" className="petora-commerce-panel petora-pets-panel">

    <div className="petora-commerce-heading">
      <div>
        <span className="eyebrow">SHOP BY PET</span>
        <h2>Find your next companion.</h2>
      </div>

      <p>
        Explore the pets currently featured by PETORA and discover the
        category that matches your lifestyle.
      </p>
    </div>

    <div className="petora-pet-list">

      <button
        type="button"
        className="petora-pet-card"
        onClick={() => {
          setCategory("Dogs");
          goTo("pets");
        }}
      >
        <div className="petora-pet-photo">
          <img
            src="/products/dogo-argentino.jpg"
            alt="Dog"
          />
          <span>VIEW DOGS</span>
        </div>

        <div className="petora-pet-info">
          <small>COMPANIONS</small>
          <h3>Dogs</h3>
          <p>Dogs & available companions</p>
        </div>

        <span className="petora-round-arrow">→</span>
      </button>

      <button
        type="button"
        className="petora-pet-card"
        onClick={() => {
          setCategory("Cats");
          goTo("pets");
        }}
      >
        <div className="petora-pet-photo">
          <img
            src="/products/persian-cat.jpg"
            alt="Cat"
          />
          <span>VIEW CATS</span>
        </div>

        <div className="petora-pet-info">
          <small>COMPANIONS</small>
          <h3>Cats</h3>
          <p>Cats & available companions</p>
        </div>

        <span className="petora-round-arrow">→</span>
      </button>

      <button
        type="button"
        className="petora-pet-card"
        onClick={() => {
          setCategory("Aquatics");
          goTo("pets");
        }}
      >
        <div className="petora-pet-photo">
          <img
            src="/products/golden-arowana.jpg"
            alt="Aquatic fish"
          />
          <span>VIEW FISH</span>
        </div>

        <div className="petora-pet-info">
          <small>AQUATICS</small>
          <h3>Fish</h3>
          <p>Golden Arowana & aquatic companions</p>
        </div>

        <span className="petora-round-arrow">→</span>
      </button>

    </div>

    <div className="petora-commerce-trust">
      <span>✓ Real listings</span>
      <span>✓ Clear information</span>
      <span>✓ PETORA guidance</span>
    </div>

  </section>


  {/* =====================================================
      RIGHT — REAL PRODUCT STORE
      ===================================================== */}
  <section id="shop" className="petora-commerce-panel petora-store-panel">

    <div className="petora-commerce-heading">
      <div>
        <span className="eyebrow">PETORA STORE</span>
        <h2>Everything your pet needs.</h2>
      </div>

      <p>
        Shop food, care products and accessories using live PETORA inventory.
      </p>
    </div>

    {productsLoading && (
      <div className="petora-store-state">
        <span className="petora-store-spinner"></span>
        <strong>Loading products...</strong>
      </div>
    )}

    {!productsLoading && productsError && (
      <div className="petora-store-state">
        <strong>Store unavailable</strong>
        <span>{productsError}</span>
      </div>
    )}

    {!productsLoading && !productsError && products.length === 0 && (
      <div className="petora-store-state">
        <strong>More products coming soon</strong>
        <span>
          Products will appear here as they are added to PETORA inventory.
        </span>
      </div>
    )}

    {!productsLoading && !productsError && products.length > 0 && (
      <div className="petora-product-list">

        {products.slice(0, 3).map((product) => {
          const priceNumber = Number(
            product.price.replace(/[^\d.]/g, "")
          );

          const mrpNumber = Number(
            product.mrp.replace(/[^\d.]/g, "")
          );

          const price = Number.isFinite(priceNumber)
            ? `₹${priceNumber.toLocaleString("en-IN")}`
            : product.price;

          const mrp =
            Number.isFinite(mrpNumber) &&
            mrpNumber > priceNumber
              ? `₹${mrpNumber.toLocaleString("en-IN")}`
              : "";

          const productImageMap: Record<string, string> = {
            PF001: "/products/premium-puppy-food.png",
            PP001: "/products/pet-shampoo.png",
            PA001: "/products/premium-dog-collar.png",
          };

          const image =
            productImageMap[product.product_id] ||
            (product.image
              ? product.image.startsWith("http")
                ? product.image
                : `/${product.image.replace(/^\/+/, "")}`
              : "");

          const whatsappText = encodeURIComponent(
            `Hello PETORA, I want to order ${product.product_name} (${product.product_id}) listed at ${price}.`
          );

          return (
            <article
              key={product.product_id}
              className="petora-product-card"
            >
              <div className="petora-product-image">

                {image ? (
                  <img
                    src={image}
                    alt={product.product_name}
                  />
                ) : (
                  <div className="petora-product-art">
                    <span>
                      {product.category === "Pet Food"
                        ? "FOOD"
                        : product.category === "Accessories"
                          ? "ACCESSORY"
                          : "CARE"}
                    </span>
                  </div>
                )}

                {mrp && (
                  <span className="petora-product-offer">
                    SALE
                  </span>
                )}

              </div>

              <div className="petora-product-content">

                <div className="petora-product-topline">
                  <span>
                    {product.subcategory || product.category}
                  </span>

                  <b>
                    {product.stock} in stock
                  </b>
                </div>

                <h3>{product.product_name}</h3>

                <p>
                  {product.description ||
                    "Quality everyday essentials for your pet."}
                </p>

                <div className="petora-product-price-row">
                  <strong>{price}</strong>

                  {mrp && (
                    <del>{mrp}</del>
                  )}
                </div>

                <a
                  className="petora-order-button"
                  href={`https://wa.me/917011769749?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Order on WhatsApp
                  <span>→</span>
                </a>

              </div>
            </article>
          );
        })}

      </div>
    )}

    <div className="petora-commerce-store-footer">
      <span>Live product inventory</span>
      <span>Secure order conversation</span>
      <strong>PETORA Store</strong>
    </div>

  </section>

</div>




      {/* =========================
          MARKETPLACE
      ========================= */}
      <section
        id="pets"
        className="marketplace-section"
      >

        <div className="marketplace-heading">

          <div>
            <span className="eyebrow">
              AVAILABLE PETS
            </span>

            <h2>
              Find Your New Best Friend
            </h2>

            <p>
              Browse current PETORA listings.
            </p>
          </div>

          <div className="availability-badge">
            {availablePets.length} Available
          </div>

        </div>

        <div className="marketplace-layout">

          {/* =====================
              LEFT MARKETPLACE
          ====================== */}
          <div className="marketplace-main">

            <div className="search-row">

              <div className="search-box">

                <span>
                  ⌕
                </span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search breed, pet ID or location..."
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                  >
                    Clear
                  </button>
                )}

              </div>

            </div>

            <div className="filter-row">

              <button
                type="button"
                className={
                  category ===
                  "All"
                    ? "filter-button active"
                    : "filter-button"
                }
                onClick={() =>
                  setCategory(
                    "All"
                  )
                }
              >
                All Pets
              </button>

              <button
                type="button"
                className={
                  category ===
                  "Dogs"
                    ? "filter-button active"
                    : "filter-button"
                }
                onClick={() =>
                  setCategory(
                    "Dogs"
                  )
                }
              >
                Dogs
              </button>

            </div>

            {loading && (
              <div className="inventory-state">

                <div className="loading-spinner" />

                <h3>
                  Loading PETORA inventory...
                </h3>

                <p>
                  Checking current listings.
                </p>

              </div>
            )}

            {!loading &&
              inventoryError && (
                <div className="inventory-state error-state">

                  <h3>
                    Inventory unavailable
                  </h3>

                  <p>
                    {inventoryError}
                  </p>

                </div>
              )}

            {!loading &&
              !inventoryError &&
              filteredPets.length ===
                0 && (
                <div className="inventory-state">

                  <div className="empty-paw">
                    <span />
                    <span />
                  </div>

                  <h3>
                    No matching pets found
                  </h3>

                  <p>
                    Try another breed,
                    pet ID or location.
                  </p>

                </div>
              )}

            {!loading &&
              !inventoryError &&
              filteredPets.length >
                0 && (
                <div className="pet-grid">

                  {filteredPets.map(
                    (pet) => (
                      <article
                        key={pet.id}
                        className="pet-card"
                      >

                        {/* REAL IMAGE */}
                        <div className="pet-image-wrap">

                          <img
                            src={pet.image}
                            alt={`${pet.name} - ${pet.breed}`}
                            className="pet-image"
                          />

                          <span className="pet-status">
                            ✓ Available
                          </span>

                        </div>

                        <div className="pet-card-body">

                          <span className="pet-category">
                            {pet.category}
                          </span>

                          <h3>
                            {pet.breed}
                          </h3>

                          <p className="pet-name">
                            {pet.name}
                            {" · "}
                            {pet.id}
                          </p>

                          <div className="pet-details">

                            {pet.gender && (
                              <span>
                                <b>
                                  Gender
                                </b>
                                {pet.gender}
                              </span>
                            )}

                            {pet.age && (
                              <span>
                                <b>
                                  Age
                                </b>
                                {pet.age}
                              </span>
                            )}

                            {pet.location && (
                              <span>
                                <b>
                                  Location
                                </b>
                                {pet.location}
                              </span>
                            )}

                            {pet.vaccinated && (
                              <span>
                                <b>
                                  Vaccinated
                                </b>
                                {pet.vaccinated}
                              </span>
                            )}

                          </div>

                          <div className="pet-card-footer">

                            <div>
                              <small>
                                Price
                              </small>

                              <strong>
                                {money(
                                  pet.price
                                )}
                              </strong>
                            </div>

                            <button
                              type="button"
                              className="interest-button"
                              onClick={() =>
                                choosePet(
                                  pet
                                )
                              }
                            >
                              I&apos;m Interested →
                            </button>

                          </div>

                        </div>

                      </article>
                    )
                  )}

                </div>
              )}

          </div>

          {/* =====================
              AI PANEL
          ====================== */}
          <aside
            id="ai"
            className="ai-panel"
          >

            <div className="ai-header">

              <div className="ai-avatar">
                ✦
              </div>

              <div>
                <strong>
                  PETORA AI Assistant
                </strong>

                <span>
                  Ask about pets, prices,
                  availability or care.
                </span>
              </div>

            </div>

            <div className="ai-conversation">

              <div className="ai-user-message">
                Which dog breeds are available?
              </div>

              <div className="ai-message">
                {aiAnswer}
              </div>

              <div className="ai-user-message">
                What is the price of ST001?
              </div>

              <div className="ai-message">
                {(() => {
                  const pet =
                    availablePets.find(
                      (item) =>
                        item.id
                          .toLowerCase() ===
                        "st001"
                    );

                  return pet
                    ? `${pet.id} – ${pet.name}. ${pet.breed}. ${money(
                        pet.price
                      )}.`
                    : "ST001 is not currently available.";
                })()}
              </div>

            </div>

            <div className="ai-input-row">

              <input
                value={aiQuestion}
                onChange={(event) =>
                  setAiQuestion(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    askAI();
                  }
                }}
                placeholder="Ask PETORA AI..."
              />

              <button
                type="button"
                onClick={
                  askAI
                }
              >
                ↑
              </button>

            </div>

          </aside>

        </div>
      </section>

      {/* =========================
          TRUST STRIP
      ========================= */}
      <section className="trust-strip">

        <div>
          <strong>
            Wide Range of Pets
          </strong>

          <span>
            Growing PETORA categories
          </span>
        </div>

        <div>
          <strong>
            Ethical & Responsible
          </strong>

          <span>
            Thoughtful pet discovery
          </span>
        </div>

        <div>
          <strong>
            Local First
          </strong>

          <span>
            Starting with Patna
          </span>
        </div>

        <div>
          <strong>
            Support & Guidance
          </strong>

          <span>
            Pet-focused assistance
          </span>
        </div>

      </section>

      {/* =========================
          ABOUT
      ========================= */}
      <section className="about-section">

        <div className="about-copy">

          <span className="eyebrow">
            ABOUT PETORA
          </span>

          <h2>
            Different Pets.
            <br />
            Same Love.
          </h2>

          <p>
            PETORA is being built as a modern
            pet discovery platform where people
            can discover animals, explore clear
            pet information, and connect with
            companions through a better digital
            experience.
          </p>

          <div className="about-points">

            <span>
              ✓ Better discovery
            </span>

            <span>
              ✓ Clear information
            </span>

            <span>
              ✓ AI-assisted guidance
            </span>

          </div>

        </div>

        <div className="about-brand-card">

          <img
            src="/petora-logo.png"
            alt="PETORA"
          />

          <strong>
            More Pets.
            <br />
            A Wilder World.
          </strong>

        </div>

      </section>

      {/* =========================
          CONTACT / ENQUIRY
      ========================= */}
              

<section
        id="contact"
        className="contact-section"
      >

        <div className="contact-heading">

          <span className="eyebrow">
            PETORA
          </span>

          <h2>
            Ready to meet your companion?
          </h2>

          <p>
            Send an enquiry and the PETORA
            team can follow up with you.
          </p>

          {selectedPet && (
            <div className="selected-pet">

              <span>
                Selected pet
              </span>

              <strong>
                {selectedPet.name}
                {" · "}
                {selectedPet.id}
              </strong>

            </div>
          )}

        </div>

        <div className="contact-layout">

          <form
            className="enquiry-form"
            onSubmit={
              submitEnquiry
            }
          >

            <div className="form-grid">

              <label>
                <span>
                  Name
                </span>

                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  placeholder="Your full name"
                  required
                />
              </label>

              <label>
                <span>
                  Phone
                </span>

                <input
                  type="tel"
                  name="phone"
                  placeholder="+91 XXXXX XXXXX"
                  required
                />
              </label>

            </div>

            <label>

              <span>
                Select Pet
              </span>

              <select
                name="pet_id"
                value={
                  selectedPetId
                }
                onChange={(event) =>
                  setSelectedPetId(
                    event.target.value
                  )
                }
                required
              >

                <option
                  value=""
                  disabled
                >
                  Choose an available pet
                </option>

                {availablePets.map(
                  (pet) => (
                    <option
                      key={pet.id}
                      value={pet.id}
                    >
                      {pet.breed}
                      {" · "}
                      {pet.id}
                    </option>
                  )
                )}

              </select>

            </label>

            <label>

              <span>
                Message
              </span>

              <textarea
                name="message"
                rows={5}
                placeholder="Tell us what you would like to know..."
                required
              />

            </label>

            {formMessage && (
              <div className="form-message">
                {formMessage}
              </div>
            )}

            <button
              type="submit"
              className="primary-button form-submit"
              disabled={
                submitting
              }
            >
              {submitting
                ? "Sending..."
                : "Send Enquiry →"}
            </button>

            <small className="form-note">
              Your enquiry is sent securely
              to the PETORA business team.
            </small>

          </form>

          <div className="contact-info-card">

            <span className="eyebrow">
              CONTACT
            </span>

            <h3>
              PETORA
            </h3>

            <p>
              Pets Beyond Borders
            </p>

            <div className="contact-lines">

              <span>
                📍 Patna, Bihar
              </span>

              <a
                href="https://wa.me/917011769749"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-whatsapp"
              >
                💬 WhatsApp
              </a>

              <span>
                ✦ PETORA Support
              </span>

            </div>

            <div className="contact-brand">

              <img
                src="/petora-logo.png"
                alt="PETORA"
              />

            </div>

          </div>

        </div>
      </section>

      {/* =========================
          FOOTER
      ========================= */}
      <footer className="site-footer">

        <div className="footer-main">

          <div className="footer-brand">

            <strong>
              PETORA™
            </strong>

            <span>
              PETS BEYOND BORDERS
            </span>

            <p>
              More Pets. A Wilder World.
            </p>

          </div>

          <div className="footer-column">

            <strong>
              EXPLORE
            </strong>

            <button
              type="button"
              onClick={() =>
                goTo("home")
              }
            >
              Home
            </button>

            <button
              type="button"
              onClick={() =>
                goTo("pets")
              }
            >
              Pets
            </button>

            <button
              type="button"
              onClick={() =>
                goTo("categories")
              }
            >
              Categories
            </button>

            <button
              type="button"
              onClick={() =>
                goTo("ai")
              }
            >
              PETORA AI
            </button>

          </div>

          <div className="footer-column">

            <strong>
              CATEGORIES
            </strong>

            <button
              type="button"
              onClick={() => {
                setCategory(
                  "Dogs"
                );
                goTo("pets");
              }}
            >
              Dogs
            </button>

            <button
              type="button"
              onClick={() =>
                goTo("categories")
              }
            >
              Cats
            </button>

            <button
              type="button"
              onClick={() =>
                goTo("categories")
              }
            >
              Aquatics
            </button>

            <button
              type="button"
              onClick={() =>
                goTo("categories")
              }
            >
              
            </button>

          </div>

          <div className="footer-column">

            <strong>
              CONTACT
            </strong>

            <span>
              📍 Patna, Bihar
            </span>

            <span>
              💬 WhatsApp
            </span>

            <span>
              ✦ PETORA Support
            </span>

          </div>

        </div>

        <div className="footer-bottom">

          <span>
            © 2026 PETORA
          </span>

          <span>
            Pets Beyond Borders ·
            Different Pets. Same Love.
          </span>

        </div>

      </footer>

    </main>
  );
}