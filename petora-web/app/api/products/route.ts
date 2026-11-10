
import { google } from "googleapis";
import { NextResponse } from "next/server";

function getConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Google Sheets environment variables are missing.");
  }

  return {
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    spreadsheetId,
  };
}

async function getSheets() {
  const { clientEmail, privateKey } = getConfig();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

// Only allow secure web links in shopping fields.
function safeHttpsUrl(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export async function GET() {
  try {
    const { spreadsheetId } = getConfig();
    const sheets = await getSheets();

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Products!A:O",
    });

    const rows = result.data.values ?? [];

    if (rows.length < 2) {
      return NextResponse.json([]);
    }

    const headers = rows[0].map((value) =>
      clean(value).toLowerCase().replace(/\s+/g, "_")
    );

    const products = rows.slice(1).map((row) => {
      const record: Record<string, string> = {};

      headers.forEach((header, index) => {
        record[header] = clean(row[index]);
      });

      return {
        product_id: record.product_id || "",
        category: record.category || "",
        subcategory: record.subcategory || "",
        product_name: record.product_name || "",
        brand: record.brand || "",
        price: record.price || "",
        mrp: record.mrp || "",
        stock: record.stock || "",
        unit: record.unit || "",
        image: record.image || ({
          "PF001": "/products/premium-puppy-food.png",
          "PP001": "/products/pet-shampoo.png",
          "PA001": "/products/premium-dog-collar.png",
        }[record.product_id] || ""),
        description: record.description || "",
        status: record.status || "",

        // Shopping destinations
        product_url: safeHttpsUrl(record.product_url),
        retailer: record.retailer || "PETORA",
        affiliate_url: safeHttpsUrl(record.affiliate_url),
      };
    });

    return NextResponse.json(products, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/products failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load products.",
      },
      { status: 500 }
    );
  }
}
