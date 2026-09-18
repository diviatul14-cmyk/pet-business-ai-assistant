import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Google Sheets environment variables are missing.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    auth,
    spreadsheetId,
  };
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function getPrice(value: unknown): number {
  const number = Number(
    clean(value)
      .replace(/₹/g, "")
      .replace(/,/g, "")
      .replace(/\s/g, "")
  );

  return Number.isFinite(number) ? number : 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const productId = clean(body.product_id);
    const customerName = clean(body.customer_name);
    const phone = clean(body.phone);
    const email = clean(body.email);
    const address = clean(body.address);

    const paymentId = clean(body.razorpay_payment_id);
    const orderId = clean(body.razorpay_order_id);
    const signature = clean(body.razorpay_signature);

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
          error: "Required order or customer information is missing.",
        },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error("Razorpay server credentials are missing.");
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const { auth, spreadsheetId } = getGoogleAuth();

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    /*
     * Read the LIVE Products sheet.
     * The browser price is never trusted.
     */
    const productsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Products!A:Z",
    });

    const rows = productsResponse.data.values || [];

    if (rows.length === 0) {
      throw new Error("Products sheet is empty.");
    }

    const headers = rows[0].map((header) =>
      clean(header).toLowerCase()
    );

    const productIdIndex = headers.indexOf("product_id");
    const productNameIndex = headers.indexOf("product_name");
    const brandIndex = headers.indexOf("brand");
    const priceIndex = headers.indexOf("price");
    const statusIndex = headers.indexOf("status");
    const stockIndex = headers.indexOf("stock");
    const unitIndex = headers.indexOf("unit");

    if (productIdIndex === -1 || priceIndex === -1) {
      throw new Error(
        "Products sheet must contain product_id and price columns."
      );
    }

    const productRow = rows.slice(1).find(
      (row) =>
        clean(row[productIdIndex]).toUpperCase() ===
        productId.toUpperCase()
    );

    if (!productRow) {
      return NextResponse.json(
        {
          success: false,
          error: "Product not found in the live Products inventory.",
        },
        { status: 404 }
      );
    }

    const productPrice = getPrice(productRow[priceIndex]);

    if (!productPrice || productPrice <= 0) {
      throw new Error(
        "The product does not have a valid purchase price."
      );
    }

    const productStatus =
      statusIndex >= 0 ? clean(productRow[statusIndex]) : "";

    if (
      productStatus &&
      ["sold", "inactive", "unavailable", "out of stock"].includes(
        productStatus.toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This product is currently unavailable.",
        },
        { status: 409 }
      );
    }

    const expectedAmount = Math.round(productPrice * 100);

    /*
     * Retrieve the Razorpay order from Razorpay.
     */
    const razorpayOrder = await razorpay.orders.fetch(orderId);

    if (!razorpayOrder) {
      throw new Error("Razorpay order could not be found.");
    }

    if (razorpayOrder.currency !== "INR") {
      throw new Error("Razorpay order currency is invalid.");
    }

    if (Number(razorpayOrder.amount) !== expectedAmount) {
      throw new Error(
        "Payment amount does not match the current product price."
      );
    }

    /*
     * Verify Razorpay signature.
     */
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment signature verification failed.",
        },
        { status: 400 }
      );
    }

    /*
     * Retrieve the actual Razorpay payment.
     */
    const payment = await razorpay.payments.fetch(paymentId);

    if (!payment) {
      throw new Error("Razorpay payment could not be found.");
    }

    if (payment.order_id !== orderId) {
      throw new Error(
        "Payment does not belong to the supplied Razorpay order."
      );
    }

    if (Number(payment.amount) !== expectedAmount) {
      throw new Error(
        "Payment amount does not match the product price."
      );
    }

    if (payment.currency !== "INR") {
      throw new Error("Payment currency is invalid.");
    }

    if (payment.status !== "captured") {
      return NextResponse.json(
        {
          success: false,
          error: `Payment is not captured. Current status: ${payment.status}`,
        },
        { status: 400 }
      );
    }

    /*
     * Create ProductBookings sheet if it does not exist.
     */
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const existingSheets =
      spreadsheet.data.sheets || [];

    const productBookingsSheetExists =
      existingSheets.some(
        (sheet) =>
          sheet.properties?.title === "ProductBookings"
      );

    if (!productBookingsSheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: "ProductBookings",
                },
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "ProductBookings!A1:N1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              "booking_id",
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
            ],
          ],
        },
      });
    }

    /*
     * Prevent duplicate booking records.
     */
    const bookingsResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "ProductBookings!A:N",
      });

    const bookingRows =
      bookingsResponse.data.values || [];

    const duplicatePayment = bookingRows
      .slice(1)
      .some((row) => clean(row[11]) === paymentId);

    if (!duplicatePayment) {
      const bookingId =
        `PB-${productId}-${Date.now()}`;

      const now = new Date().toISOString();

      const productName =
        productNameIndex >= 0
          ? clean(productRow[productNameIndex])
          : "PETORA Product";

      const brand =
        brandIndex >= 0
          ? clean(productRow[brandIndex])
          : "PETORA";

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "ProductBookings!A:N",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [
            [
              bookingId,
              now,
              productId,
              productName,
              brand,
              customerName,
              phone,
              email,
              address,
              productPrice,
              productPrice,
              paymentId,
              orderId,
              "CAPTURED",
            ],
          ],
        },
      });
    }

    return NextResponse.json({
      success: true,
      booking_confirmed: true,
      product: {
        product_id: productId,
        product_name:
          productNameIndex >= 0
            ? clean(productRow[productNameIndex])
            : "PETORA Product",
        brand:
          brandIndex >= 0
            ? clean(productRow[brandIndex])
            : "PETORA",
        price: productPrice,
        unit:
          unitIndex >= 0
            ? clean(productRow[unitIndex])
            : "",
        stock:
          stockIndex >= 0
            ? clean(productRow[stockIndex])
            : "",
      },
      payment_amount: productPrice,
      payment_id: paymentId,
      razorpay_order_id: orderId,
      payment_status: "CAPTURED",
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
