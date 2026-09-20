import { google } from "googleapis";
import Razorpay from "razorpay";
import crypto from "crypto";
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
  const {
    clientEmail,
    privateKey,
    spreadsheetId,
  } = getConfig();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const response =
    await sheets.spreadsheets.values.get({
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

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedSignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

async function getSheetsClient() {
  const {
    clientEmail,
    privateKey,
    spreadsheetId,
  } = getConfig();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

  return {
    sheets: google.sheets({
      version: "v4",
      auth,
    }),
    spreadsheetId,
  };
}

async function ensureProductOrdersSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
) {
  const spreadsheet =
    await sheets.spreadsheets.get({
      spreadsheetId,
    });

  const exists = (
    spreadsheet.data.sheets ?? []
  ).some(
    (sheet) =>
      sheet.properties?.title ===
      "ProductOrders"
  );

  if (exists) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: "ProductOrders",
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "ProductOrders!A1:O1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          "order_id",
          "date",
          "product_id",
          "product_name",
          "brand",
          "customer_name",
          "phone",
          "email",
          "address",
          "product_price",
          "payment_amount",
          "payment_id",
          "razorpay_order_id",
          "payment_status",
          "order_status",
        ],
      ],
    },
  });
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    /*
     * Customer information
     */
    const productId = clean(
      body?.product_id
    );

    const customerName = clean(
      body?.customer_name
    );

    const phone = clean(
      body?.phone
    );

    const email = clean(
      body?.email
    );

    const address = clean(
      body?.address
    );

    /*
     * Razorpay information
     */
    const paymentId = clean(
      body?.razorpay_payment_id
    );

    const orderId = clean(
      body?.razorpay_order_id
    );

    const signature = clean(
      body?.razorpay_signature
    );

    if (
      !productId ||
      !customerName ||
      !phone ||
      !email ||
      !address ||
      !paymentId ||
      !orderId ||
      !signature
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Required order or customer information is missing.",
        },
        { status: 400 }
      );
    }

    /*
     * Razorpay credentials
     */
    const razorpayKeyId =
      process.env.RAZORPAY_KEY_ID;

    const razorpayKeySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Razorpay server credentials are missing.",
        },
        { status: 500 }
      );
    }

    /*
     * Get the CURRENT product record
     * from Google Sheets.
     */
    const products =
      await getProducts();

    const product =
      products.find(
        (item) =>
          clean(item.product_id)
            .toLowerCase() ===
          productId.toLowerCase()
      );

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Product ${productId} was not found.`,
        },
        { status: 404 }
      );
    }

    /*
     * IMPORTANT:
     *
     * Price is taken from Google Sheets.
     * Never trust a price sent by the browser.
     */
    const productPrice =
      parsePrice(product.price);

    if (productPrice <= 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid product price for ${product.product_name}.`,
        },
        { status: 400 }
      );
    }

    /*
     * Check current stock/status.
     */
    const stock =
      clean(product.stock).toLowerCase();

    const status =
      clean(product.status).toLowerCase();

    const unavailable =
      stock === "0" ||
      stock === "out of stock" ||
      stock === "sold out" ||
      status === "out of stock" ||
      status === "inactive" ||
      status === "unavailable";

    if (unavailable) {
      return NextResponse.json(
        {
          success: false,
          error:
            `${product.product_name} is currently out of stock.`,
        },
        { status: 409 }
      );
    }

    /*
     * Expected Razorpay amount.
     */
    const expectedAmount =
      Math.round(productPrice * 100);

    /*
     * Create Razorpay server client.
     */
    const razorpay =
      new Razorpay({
        key_id: razorpayKeyId,
        key_secret:
          razorpayKeySecret,
      });

    /*
     * Fetch the Razorpay order.
     */
    const order =
      await razorpay.orders.fetch(
        orderId
      );

    if (
      !order ||
      order.id !== orderId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Razorpay order could not be verified.",
        },
        { status: 400 }
      );
    }

    /*
     * Check currency.
     */
    if (
      order.currency !== "INR"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid payment currency.",
        },
        { status: 400 }
      );
    }

    /*
     * Check Razorpay order amount
     * against the CURRENT Google Sheets price.
     */
    if (
      Number(order.amount) !==
      expectedAmount
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Payment amount does not match the current product price.",
        },
        { status: 400 }
      );
    }

    /*
     * Verify Razorpay signature.
     */
    const signatureValid =
      verifySignature(
        orderId,
        paymentId,
        signature,
        razorpayKeySecret
      );

    if (!signatureValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid Razorpay payment signature.",
        },
        { status: 400 }
      );
    }

    /*
     * Fetch the actual payment from Razorpay.
     */
    const payment =
      await razorpay.payments.fetch(
        paymentId
      );

    /*
     * Payment must belong to
     * the same Razorpay order.
     */
    if (
      !payment ||
      payment.order_id !== orderId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Payment does not belong to this order.",
        },
        { status: 400 }
      );
    }

    /*
     * Check actual paid amount.
     */
    if (
      Number(payment.amount) !==
      expectedAmount
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Paid amount does not match the current product price.",
        },
        { status: 400 }
      );
    }

    /*
     * Check payment currency.
     */
    if (
      payment.currency !== "INR"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid payment currency.",
        },
        { status: 400 }
      );
    }

    /*
     * Payment must be captured.
     */
    if (
      payment.status !==
      "captured"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Payment is not captured. Current status: ${payment.status}.`,
        },
        { status: 400 }
      );
    }

    /*
     * Get Google Sheets client.
     */
    const {
      sheets,
      spreadsheetId,
    } = await getSheetsClient();

    /*
     * Make sure ProductOrders exists.
     */
    await ensureProductOrdersSheet(
      sheets,
      spreadsheetId
    );

    /*
     * Check whether this payment
     * has already been recorded.
     */
    const existing =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId,
          range: "ProductOrders!A:O",
        }
      );

    const rows =
      existing.data.values ?? [];

    const alreadySaved =
      rows
        .slice(1)
        .some(
          (row) =>
            clean(row[11]) ===
            paymentId
        );

    /*
     * Save the order only once.
     */
    if (!alreadySaved) {
      const orderRecordId =
        `PO-${product.product_id}-${Date.now()}`;

      await sheets.spreadsheets.values.append(
        {
          spreadsheetId,
          range:
            "ProductOrders!A:O",

          valueInputOption:
            "USER_ENTERED",

          insertDataOption:
            "INSERT_ROWS",

          requestBody: {
            values: [
              [
                orderRecordId,

                new Date().toISOString(),

                product.product_id,

                product.product_name,

                product.brand,

                customerName,

                phone,

                email,

                address,

                productPrice,

                expectedAmount / 100,

                paymentId,

                orderId,

                "CAPTURED",

                "ORDER_CONFIRMED",
              ],
            ],
          },
        }
      );
    }

    /*
     * Final success response.
     */
    return NextResponse.json({
      success: true,

      order_confirmed: true,

      payment_status: "CAPTURED",

      product: {
        product_id:
          product.product_id,

        product_name:
          product.product_name,

        brand:
          product.brand,

        unit:
          product.unit,

        price:
          productPrice,

        mrp:
          parsePrice(product.mrp),
      },

      amount:
        expectedAmount / 100,

      payment_id:
        paymentId,

      order_id:
        orderId,
    });
  } catch (error) {
    console.error(
      "PETORA product payment verification error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify product payment.",
      },
      { status: 500 }
    );
  }
}