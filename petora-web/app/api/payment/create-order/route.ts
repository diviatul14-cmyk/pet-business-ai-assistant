import { NextResponse } from "next/server";
import { google } from "googleapis";
import Razorpay from "razorpay";

export const dynamic = "force-dynamic";

type InventoryRow = Record<string, string>;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parsePrice(value: unknown): number {
  const number = Number(
    clean(value).replace(/[₹,\s]/g, "")
  );

  return Number.isFinite(number) && number > 0
    ? number
    : 0;
}

async function getInventory(): Promise<InventoryRow[]> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error(
      "Google Sheets credentials are not fully configured."
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Inventory!A:Z",
  });

  const rows = response.data.values ?? [];

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeKey);

  return rows.slice(1).map((row) => {
    const item: InventoryRow = {};

    headers.forEach((header, index) => {
      if (header) {
        item[header] = clean(row[index]);
      }
    });

    return item;
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const petId = clean(body?.pet_id);

    if (!petId) {
      return NextResponse.json(
        { success: false, error: "Pet ID is required." },
        { status: 400 }
      );
    }

    const inventory = await getInventory();

    const pet = inventory.find(
      (item) =>
        clean(item.pet_id).toLowerCase() === petId.toLowerCase()
    );

    if (!pet) {
      return NextResponse.json(
        { success: false, error: "Pet not found in Inventory." },
        { status: 404 }
      );
    }

    const status = clean(pet.status).toLowerCase();

    if (
      [
        "sold",
        "unavailable",
        "out_of_stock",
        "out of stock",
      ].includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This pet is no longer available for booking.",
        },
        { status: 409 }
      );
    }

    const petPrice = parsePrice(
      pet.price_inr || pet.price || pet.sale_price
    );

    if (!petPrice) {
      return NextResponse.json(
        {
          success: false,
          error: "Pet price is missing or invalid in Inventory.",
        },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error(
        "Razorpay server credentials are not configured."
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const amountInPaise = Math.round(petPrice * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `PETORA-${petId}-${Date.now()}`
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 40),
      notes: {
        booking_type: "PETORA_FULL_PAYMENT",
        pet_id: pet.pet_id,
        pet_name: clean(pet.name || pet.pet_id),
        pet_price: String(petPrice),
      },
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id:
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || keyId,
      pet: {
        id: pet.pet_id,
        name: clean(pet.name || pet.pet_id),
        breed: clean(pet.breed),
        price: petPrice,
      },
    });
  } catch (error: unknown) {
    console.error("PETORA booking create-order error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to create the PETORA booking payment order.",
      },
      { status: 500 }
    );
  }
}
