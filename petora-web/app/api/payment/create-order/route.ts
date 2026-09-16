import { NextResponse } from "next/server";
import { google } from "googleapis";
import Razorpay from "razorpay";

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

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail) {
    throw new Error("GOOGLE_CLIENT_EMAIL is missing.");
  }

  if (!privateKey) {
    throw new Error("GOOGLE_PRIVATE_KEY is missing.");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
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

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId) {
    throw new Error("RAZORPAY_KEY_ID is missing.");
  }

  if (!keySecret) {
    throw new Error("RAZORPAY_KEY_SECRET is missing.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function parsePrice(value: string): number {
  const cleaned = value.replace(/[₹,\s]/g, "");
  const price = Number(cleaned);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid pet price: ${value}`);
  }

  return price;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const petId = clean(body?.pet_id);

    if (!petId) {
      return NextResponse.json(
        { error: "Pet ID is required." },
        { status: 400 }
      );
    }

    /*
     * IMPORTANT:
     * The payment amount comes ONLY from the PETORA Inventory sheet.
     *
     * The browser cannot choose or modify the payment amount.
     *
     * Example:
     * Lucky -> Inventory price = 19000
     * Razorpay amount = ₹19,000
     */

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

    const pet = inventory.find(
      (item) => item.pet_id === petId
    );

    if (!pet) {
      return NextResponse.json(
        { error: "Pet not found." },
        { status: 404 }
      );
    }

    const status = pet.status.toLowerCase();

    if (
      status === "sold" ||
      status === "unavailable"
    ) {
      return NextResponse.json(
        {
          error:
            "This pet is no longer available for purchase.",
        },
        { status: 409 }
      );
    }

    const petPrice = parsePrice(pet.price);

    const amountInPaise = Math.round(
      petPrice * 100
    );

    const receipt = `PETORA-${petId}-${Date.now()}`
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 40);

    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        pet_id: pet.pet_id,
        pet_name: pet.name || pet.pet_id,
        purchase_type: "PETORA_FULL_PAYMENT",
        pet_price: String(petPrice),
      },
    });

    return NextResponse.json(
      {
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        pet: {
          id: pet.pet_id,
          name: pet.name || pet.pet_id,
          breed: pet.breed,
          price: petPrice,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "PETORA Razorpay create-order error:",
      error
    );

    const details =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error:
          "Unable to create the PETORA payment order.",
        details,
      },
      { status: 500 }
    );
  }
}
