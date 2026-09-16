import { NextResponse } from "next/server";
import { google } from "googleapis";
import Razorpay from "razorpay";
import crypto from "crypto";

export const dynamic = "force-dynamic";

type InventoryRow = {
  pet_id: string;
  name: string;
  breed: string;
  price: string;
  status: string;
  location: string;
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

function parsePrice(value: string): number {
  const cleaned = value.replace(/[₹,\s]/g, "");
  const price = Number(cleaned);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid pet price: ${value}`);
  }

  return price;
}

function normalizeInventory(
  rows: string[][]
): InventoryRow[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) =>
    clean(header)
      .toLowerCase()
      .replace(/\s+/g, "_")
  );

  const indexOf = (name: string) =>
    headers.indexOf(name);

  return rows.slice(1).map((row) => {
    const value = (column: string): string => {
      const index = indexOf(column);
      return index >= 0
        ? clean(row[index])
        : "";
    };

    return {
      pet_id: value("pet_id"),
      name: value("name"),
      breed: value("breed"),
      price: value("price"),
      status: value("status"),
      location: value("location"),
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

  return {
    client: new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    }),
    secret: keySecret,
  };
}

function safeEqual(
  a: string,
  b: string
): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer
  );
}

async function ensureBookingsSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
) {
  const spreadsheet =
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        "sheets.properties(sheetId,title)",
    });

  const existingSheet =
    spreadsheet.data.sheets?.find(
      (sheet) =>
        sheet.properties?.title === "Bookings"
    );

  if (existingSheet?.properties?.title) {
    return existingSheet.properties.title;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: "Bookings",
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Bookings!A1:N1",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          "booking_id",
          "date",
          "pet_id",
          "pet_name",
          "breed",
          "customer_name",
          "phone",
          "email",
          "location",
          "product_price",
          "payment_amount",
          "payment_id",
        "upi_id",
          "razorpay_order_id",
          "payment_status",
        ],
      ],
    },
  });

  return "Bookings";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const petId = clean(body?.pet_id);
    const customerName = clean(
      body?.customer_name
    );
    const customerPhone = clean(
      body?.customer_phone
    );
    const customerEmail = clean(
      body?.customer_email
    );

    const paymentId = clean(
      body?.razorpay_payment_id
    );
    const returnedOrderId = clean(
      body?.razorpay_order_id
    );
    const receivedSignature = clean(
      body?.razorpay_signature
    );

    if (
      !petId ||
      !customerName ||
      !customerPhone ||
      !customerEmail ||
      !paymentId ||
      !returnedOrderId ||
      !receivedSignature
    ) {
      return NextResponse.json(
        {
          error:
            "Required payment or customer information is missing.",
        },
        { status: 400 }
      );
    }

    const auth = getGoogleAuth();

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const spreadsheetId = getSheetId();

    /*
     * Read the current Inventory price directly
     * from Google Sheets.
     */
    const inventoryResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Inventory!A:Z",
      });

    const inventoryRows =
      inventoryResponse.data.values ?? [];

    const inventory =
      normalizeInventory(inventoryRows);

    const pet = inventory.find(
      (item) => item.pet_id === petId
    );

    if (!pet) {
      return NextResponse.json(
        { error: "Pet not found in Inventory." },
        { status: 404 }
      );
    }

    const petPrice = parsePrice(pet.price);
    const expectedAmount = Math.round(
      petPrice * 100
    );

    const {
      client: razorpay,
      secret,
    } = getRazorpay();

    /*
     * Retrieve the order directly from Razorpay.
     *
     * This gives us the server-side order ID,
     * rather than trusting a client-supplied value
     * for signature verification.
     */
    const razorpayOrder =
      await razorpay.orders.fetch(
        returnedOrderId
      );

    const serverOrderId =
      clean(razorpayOrder.id);

    if (!serverOrderId) {
      throw new Error(
        "Razorpay order could not be verified."
      );
    }

    /*
     * Verify the Razorpay signature.
     *
     * Razorpay requires:
     * HMAC-SHA256(order_id + "|" + payment_id)
     * using the server-side key secret.
     */
    const generatedSignature =
      crypto
        .createHmac("sha256", secret)
        .update(
          `${serverOrderId}|${paymentId}`
        )
        .digest("hex");

    if (
      !safeEqual(
        generatedSignature,
        receivedSignature
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Payment signature verification failed.",
        },
        { status: 400 }
      );
    }

    /*
     * Confirm that this Razorpay order is for
     * the exact current Inventory price.
     */
    if (
      Number(razorpayOrder.amount) !==
      expectedAmount
    ) {
      return NextResponse.json(
        {
          error:
            "Payment amount does not match the PETORA Inventory price.",
        },
        { status: 400 }
      );
    }

    if (
      clean(razorpayOrder.currency)
        .toUpperCase() !== "INR"
    ) {
      return NextResponse.json(
        {
          error:
            "Unexpected payment currency.",
        },
        { status: 400 }
      );
    }

    /*
     * Retrieve the actual payment from Razorpay.
     */
    const payment =
      await razorpay.payments.fetch(
        paymentId
      );

    if (
      clean(payment.order_id) !==
      serverOrderId
    ) {
      return NextResponse.json(
        {
          error:
            "Payment does not belong to the verified Razorpay order.",
        },
        { status: 400 }
      );
    }

    if (
      Number(payment.amount) !==
      expectedAmount
    ) {
      return NextResponse.json(
        {
          error:
            "Paid amount does not match the Inventory price.",
        },
        { status: 400 }
      );
    }

    if (
      clean(payment.currency)
        .toUpperCase() !== "INR"
    ) {
      return NextResponse.json(
        {
          error:
            "Unexpected payment currency.",
        },
        { status: 400 }
      );
    }

    const paymentStatus =
      clean(payment.status).toLowerCase();

    if (paymentStatus !== "captured") {
      return NextResponse.json(
        {
          error:
            `Payment is not captured. Current status: ${paymentStatus || "unknown"}.`,
        },
        { status: 400 }
      );
    }

    /*
     * Create/find the Bookings sheet.
     */
    await ensureBookingsSheet(
      sheets,
      spreadsheetId
    );

    /*
     * Prevent duplicate booking rows if the
     * success handler is accidentally triggered
     * more than once.
     */
    const existingBookings =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Bookings!A:N",
      });

    const existingRows =
      existingBookings.data.values ?? [];

    const alreadyRecorded =
      existingRows.some(
        (row) =>
          clean(row?.[11]) === paymentId
      );

    if (!alreadyRecorded) {
      const bookingId =
        `PETORA-${petId}-${Date.now()}`
          .replace(
            /[^a-zA-Z0-9_-]/g,
            ""
          )
          .slice(0, 50);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Bookings!A:N",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [
            [
              bookingId,
              new Date().toISOString(),
              pet.pet_id,
              pet.name || pet.pet_id,
              pet.breed,
              customerName,
              customerPhone,
              customerEmail,
              pet.location,
              petPrice,
              petPrice,
              paymentId,
          (payment as any).vpa || "",
              serverOrderId,
              "CAPTURED",
            ],
          ],
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "PETORA payment verified successfully.",
        booking_confirmed: true,
        pet: {
          id: pet.pet_id,
          name: pet.name || pet.pet_id,
          breed: pet.breed,
        },
        amount: petPrice,
        currency: "INR",
        payment_id: paymentId,
        order_id: serverOrderId,
        payment_status: "CAPTURED",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "PETORA Razorpay verify error:",
      error
    );

    const details =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error:
          "Unable to verify the PETORA payment.",
        details,
      },
      { status: 500 }
    );
  }
}
