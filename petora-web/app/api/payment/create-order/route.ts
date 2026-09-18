import { NextResponse } from "next/server";
import { google } from "googleapis";
import Razorpay from "razorpay";

type ProductRow = Record<string, string>;

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
  const cleaned = clean(value).replace(/[₹,\s]/g, "");
  const number = Number(cleaned);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return number;
}

async function getProducts(): Promise<ProductRow[]> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is missing.");
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Products!A:Z",
  });

  const rows = response.data.values ?? [];

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => normalizeKey(header));

  return rows.slice(1).map((row) => {
    const product: ProductRow = {};

    headers.forEach((header, index) => {
      product[header] = clean(row[index]);
    });

    return product;
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const productId = clean(body?.product_id).toUpperCase();

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "Product ID is required.",
        },
        { status: 400 }
      );
    }

    const products = await getProducts();

    const product = products.find(
      (item) =>
        clean(item.product_id).toUpperCase() === productId
    );

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: `Product ${productId} was not found in the Products sheet.`,
        },
        { status: 404 }
      );
    }

    const productPrice = parsePrice(
      product.price ||
        product.sale_price ||
        product.selling_price ||
        product.amount
    );

    if (!productPrice) {
      return NextResponse.json(
        {
          success: false,
          error: `Price for product ${productId} is missing or invalid in the Products sheet.`,
        },
        { status: 400 }
      );
    }

    const status = clean(
      product.status || product.availability || "available"
    ).toLowerCase();

    if (
      status === "sold" ||
      status === "unavailable" ||
      status === "out_of_stock" ||
      status === "out of stock"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This product is currently unavailable.",
        },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Razorpay server credentials are not configured.",
        },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const amountInPaise = Math.round(productPrice * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `PETORA-${productId}-${Date.now()}`,
      notes: {
        purchase_type: "PETORA_PRODUCT_FULL_PAYMENT",
        product_id: productId,
        product_name: clean(
          product.product_name ||
            product.name ||
            product.title ||
            product.product
        ),
        product_price: String(productPrice),
      },
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: amountInPaise,
      currency: "INR",
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      product: {
        id: productId,
        product_id: productId,
        name: clean(
          product.product_name ||
            product.name ||
            product.title ||
            product.product
        ),
        price: productPrice,
        image: clean(
          product.image ||
            product.photo ||
            product.product_image
        ),
      },
    });
  } catch (error: unknown) {
    console.error("PRODUCT CREATE ORDER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create product payment order.",
      },
      { status: 500 }
    );
  }
}