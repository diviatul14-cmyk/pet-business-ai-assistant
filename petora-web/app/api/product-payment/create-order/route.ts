import { google } from "googleapis";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";

type ProductRecord = {
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

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function parsePrice(value: unknown): number {
  const cleaned = clean(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");

  const price = Number(cleaned);

  if (!Number.isFinite(price) || price <= 0) {
    return 0;
  }

  return price;
}

function getConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error(
      "Google Sheets environment variables are missing."
    );
  }

  return {
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    spreadsheetId,
  };
}

async function getProducts(): Promise<ProductRecord[]> {
  const { clientEmail, privateKey, spreadsheetId } = getConfig();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
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
    range: "Products!A:Z",
  });

  const rows = response.data.values ?? [];

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) =>
    clean(header).toLowerCase()
  );

  return rows.slice(1).map((row) => {
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
      image: record.image || "",
      description: record.description || "",
      status: record.status || "",
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const productId = clean(body?.product_id);

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "Product ID is required.",
        },
        { status: 400 }
      );
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Razorpay server credentials are missing.",
        },
        { status: 500 }
      );
    }

    const products = await getProducts();

    const product = products.find(
      (item) =>
        clean(item.product_id).toLowerCase() ===
        productId.toLowerCase()
    );

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: `Product ${productId} was not found.`,
        },
        { status: 404 }
      );
    }

    const productPrice = parsePrice(product.price);

    if (productPrice <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid price for ${product.product_name}.`,
        },
        { status: 400 }
      );
    }

    const stock = clean(product.stock).toLowerCase();
    const status = clean(product.status).toLowerCase();

    if (
      stock === "0" ||
      stock === "out of stock" ||
      stock === "sold out" ||
      status === "out of stock" ||
      status === "inactive" ||
      status === "unavailable"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `${product.product_name} is currently out of stock.`,
        },
        { status: 409 }
      );
    }

    /*
     * PETORA PRODUCT PAYMENT RULE
     *
     * Charge the COMPLETE product price
     * from the Products Google Sheet.
     *
     * No deposit.
     * No advance payment.
     * No partial payment.
     */
    const amountInPaise = Math.round(productPrice * 100);

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `PETORA-PRODUCT-${productId}-${Date.now()}`,
      notes: {
        purchase_type: "PETORA_PRODUCT_FULL_PAYMENT",
        product_id: product.product_id,
        product_name: product.product_name,
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
        product_id: product.product_id,
        product_name: product.product_name,
        brand: product.brand,
        price: productPrice,
        image: product.image,
      },
    });
  } catch (error) {
    console.error(
      "PETORA product create-order error:",
      error
    );

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