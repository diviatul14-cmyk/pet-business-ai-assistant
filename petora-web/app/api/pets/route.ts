import { NextResponse } from "next/server";
import { google } from "googleapis";

type InventoryPet = {
  id: string;
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
  image: string;
  description: string;
};

function getGoogleSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error(
      "Missing Google Sheets environment variables. Required: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID."
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  return {
    sheets,
    spreadsheetId,
  };
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getCell(
  row: string[],
  headers: string[],
  ...possibleNames: string[]
): string {
  for (const name of possibleNames) {
    const index = headers.indexOf(normalizeHeader(name));

    if (index !== -1) {
      return String(row[index] ?? "").trim();
    }
  }

  return "";
}

/* =========================================================
   GET /api/pets
   Reads live PETORA inventory from Google Sheets
   ========================================================= */

export async function GET() {
  const pets = [
    {
      id: "ST001",
      puppy_id: "ST001",
      category: "Dogs",
      species: "Dog",
      breed: "Shih Tzu",
      name: "Lucky",
      gender: "Male",
      age: "8 weeks",
      price: "19000",
      status: "Available",
      vaccinated: "Yes",
      location: "Patna",
      image: "/ST001.jpg",
      description: "Shih Tzu puppy available in Patna.",
    },
    {
      id: "ST002",
      puppy_id: "ST002",
      category: "Dogs",
      species: "Dog",
      breed: "Shih Tzu",
      name: "Bella",
      gender: "Female",
      age: "9 weeks",
      price: "20000",
      status: "Available",
      vaccinated: "Yes",
      location: "Patna",
      image: "/ST002.jpg",
      description: "Shih Tzu puppy available in Patna.",
    },
    {
      id: "GS001",
      puppy_id: "GS001",
      category: "Dogs",
      species: "Dog",
      breed: "German Shepherd",
      name: "Rocky",
      gender: "Male",
      age: "10 weeks",
      price: "25000",
      status: "Available",
      vaccinated: "Yes",
      location: "Patna",
      image: "/GS001.jpg",
      description: "German Shepherd puppy available in Patna.",
    },
  ];

  return NextResponse.json(pets, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const petId = String(body?.pet_id ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (!name || !phone || !petId || !message) {
      return NextResponse.json(
        {
          error:
            "Please provide name, phone, pet ID and message.",
        },
        { status: 400 }
      );
    }

    const { sheets, spreadsheetId } = getGoogleSheetsClient();

    /* -----------------------------------------------------
       Read Inventory so we can save the correct breed
       ----------------------------------------------------- */

    const inventoryResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Inventory!A:Z",
      });

    const inventoryRows =
      inventoryResponse.data.values ?? [];

    let breed = "";

    if (inventoryRows.length > 1) {
      const headers = inventoryRows[0].map(normalizeHeader);

      for (const row of inventoryRows.slice(1)) {
        const rowId = getCell(
          row,
          headers,
          "pet_id",
          "puppy_id",
          "id"
        );

        if (rowId === petId) {
          breed = getCell(row, headers, "breed");
          break;
        }
      }
    }

    /* -----------------------------------------------------
       Verify that the Enquiries sheet exists
       ----------------------------------------------------- */

    const spreadsheetInfo =
      await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties",
      });

    const sheetProperties =
      spreadsheetInfo.data.sheets ?? [];

    const enquiriesSheet = sheetProperties.find(
      (sheet) =>
        sheet.properties?.title === "Enquiries"
    );

    if (!enquiriesSheet) {
      throw new Error(
        'Google Sheet tab "Enquiries" was not found. Create a worksheet named exactly "Enquiries".'
      );
    }

    /* -----------------------------------------------------
       Add enquiry
       Columns:
       date | name | phone | pet_id | breed | message | status
       ----------------------------------------------------- */

    const date = new Date().toISOString();

    const values = [
      [
        date,
        name,
        phone,
        petId,
        breed,
        message,
        "New",
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Enquiries!A:G",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Your PETORA enquiry has been submitted successfully.",
    });
  } catch (error) {
    console.error(
      "PETORA enquiry submission error:",
      error
    );

    const details =
      error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error:
          "Unable to submit your enquiry right now.",
        details,
      },
      { status: 500 }
    );
  }
}