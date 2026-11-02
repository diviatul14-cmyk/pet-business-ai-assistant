
import { NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

type InventoryRow = {
  pet_id: string;
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
  photo: string;
  gallery_1: string;
  gallery_2: string;
  gallery_3: string;
  gallery_4: string;
  gallery_5: string;
  description: string;
};

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail) {
    throw new Error("GOOGLE_CLIENT_EMAIL is missing.");
  }

  if (!privateKey) {
    throw new Error("GOOGLE_PRIVATE_KEY is missing.");
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: formattedPrivateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

function getSheetId() {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) {
    throw new Error("GOOGLE_SHEET_ID is missing.");
  }

  return sheetId;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeInventory(rows: string[][]): InventoryRow[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) =>
    clean(header)
      .toLowerCase()
      .replace(/\s+/g, "_")
  );

  const indexOf = (name: string) => headers.indexOf(name);

  return rows.slice(1).map((row) => {
    const value = (column: string): string => {
      const index = indexOf(column);
      return index >= 0 ? clean(row[index]) : "";
    };

    return {
      pet_id: value("pet_id"),
      category: value("category"),
      species: value("species"),
      breed: value("breed"),
      name: value("name"),
      gender: value("gender"),
      age: value("age"),
      price: value("price_inr") || value("price"),
      status: value("status"),
      vaccinated: value("vaccinated"),
      location: value("location"),
      photo: value("photo"),
      gallery_1: value("gallery_1"),
      gallery_2: value("gallery_2"),
      gallery_3: value("gallery_3"),
      gallery_4: value("gallery_4"),
      gallery_5: value("gallery_5"),
      description: value("description"),
    };
  });
}

/**
 * GET /api/pets
 * Reads the live Inventory worksheet.
 */
export async function GET() {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Inventory!A:Z",
    });

    const inventory = normalizeInventory(response.data.values ?? []);

    const availablePets = inventory
      .filter((pet) => {
        const status = pet.status.trim().toLowerCase();

        return (
          pet.pet_id &&
          status !== "sold" &&
          status !== "unavailable"
        );
      })
      .map((pet) => {
        // Keep every non-empty photo path, in gallery order.
        const images = [
          pet.photo,
          pet.gallery_1,
          pet.gallery_2,
          pet.gallery_3,
          pet.gallery_4,
          pet.gallery_5,
        ].filter(Boolean).filter(
          (image, index, all) => all.indexOf(image) === index
        );

        // Existing pages can continue using the "image" field.
        const mainImage = images[0] || "";

        return {
          id: pet.pet_id,
          pet_id: pet.pet_id,
          puppy_id: pet.pet_id,

          category: pet.category || "Dogs",
          species: pet.species || "Dog",
          breed: pet.breed,
          name: pet.name || pet.pet_id,

          gender: pet.gender,
          age: pet.age,
          age_weeks: pet.age.replace(/[^0-9]/g, ""),
          price: pet.price,
          status: pet.status || "Available",
          vaccinated: pet.vaccinated,
          location: pet.location,

          // Main image for existing listing components.
          image: mainImage,
          photo: pet.photo || mainImage,

          // All images for gallery/detail components.
          images,
          gallery_1: pet.gallery_1,
          gallery_2: pet.gallery_2,
          gallery_3: pet.gallery_3,
          gallery_4: pet.gallery_4,
          gallery_5: pet.gallery_5,

          description: pet.description,
        };
      });

    return NextResponse.json(availablePets, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PETORA GET inventory error:", error);

    return NextResponse.json(
      {
        error: "Unable to load PETORA inventory.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pets
 * Adds an enquiry to the Enquiries worksheet.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = clean(body?.name);
    const phone = clean(body?.phone);
    const petId = clean(body?.pet_id);
    const submittedBreed = clean(body?.breed);
    const message = clean(body?.message);

    if (!name) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      );
    }

    if (!petId) {
      return NextResponse.json(
        { error: "Pet ID is required." },
        { status: 400 }
      );
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = getSheetId();

    const inventoryResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Inventory!A:Z",
    });

    const inventory = normalizeInventory(
      inventoryResponse.data.values ?? []
    );

    const selectedPet = inventory.find(
      (pet) => pet.pet_id.toLowerCase() === petId.toLowerCase()
    );

    if (!selectedPet) {
      return NextResponse.json(
        { error: "The selected PETORA listing could not be found." },
        { status: 400 }
      );
    }

    const petStatus = selectedPet.status.trim().toLowerCase();

    if (petStatus === "sold" || petStatus === "unavailable") {
      return NextResponse.json(
        { error: "This PETORA listing is no longer available." },
        { status: 400 }
      );
    }

    const breed = selectedPet.breed || submittedBreed;
    const now = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Enquiries!A:G",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            now,
            name,
            phone,
            selectedPet.pet_id,
            breed,
            message,
            "New",
          ],
        ],
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your PETORA enquiry has been submitted successfully.",
        pet: {
          id: selectedPet.pet_id,
          name: selectedPet.name,
          breed: selectedPet.breed,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PETORA POST enquiry error:", error);

    return NextResponse.json(
      {
        error: "Unable to submit your enquiry right now.",
      },
      { status: 500 }
    );
  }
}
