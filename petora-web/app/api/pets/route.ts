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
    clean(header).toLowerCase().replace(/\s+/g, "_")
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
      price: value("price"),
      status: value("status"),
      vaccinated: value("vaccinated"),
      location: value("location"),
      photo: value("photo"),
      description: value("description"),
    };
  });
}

/**
 * GET /api/pets
 *
 * Reads the live Inventory worksheet.
 */
export async function GET() {
  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const spreadsheetId = getSheetId();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Inventory!A:Z",
    });

    const rows = response.data.values ?? [];
    const inventory = normalizeInventory(rows);

    const availablePets = inventory
      .filter((pet) => {
        const status = pet.status.toLowerCase();

        return (
          pet.pet_id &&
          status !== "sold" &&
          status !== "unavailable"
        );
      })
      .map((pet) => ({
        id: pet.pet_id,
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
        image: pet.photo || "",
        photo: pet.photo || "",
        description: pet.description,
      }));

    return NextResponse.json(availablePets, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PETORA GET inventory error:", error);

    const details =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error: "Unable to load PETORA inventory.",
        details,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pets
 *
 * Adds an enquiry to the live Enquiries worksheet.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = clean(body?.name);
    const phone = clean(body?.phone);
    const petId = clean(body?.pet_id);
    const breed = clean(body?.breed);
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

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const spreadsheetId = getSheetId();

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
            petId,
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
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PETORA POST enquiry error:", error);

    const details =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error: "Unable to submit your enquiry right now.",
        details,
      },
      { status: 500 }
    );
  }
}