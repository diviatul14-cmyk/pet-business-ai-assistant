import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type PublicAnimalRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null;
  location_region: string | null;
  bio: string | null;
  photo_urls: string[] | null;
};

function getAge(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) return null;

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return null;

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }

  return years > 0
    ? `${years} years${months ? `, ${months} months` : ""}`
    : `${months} months`;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json(
      { error: "Public animal listings are not configured." },
      { status: 503 }
    );
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("animal_profiles")
    .select(
      "id, name, species, breed, sex, date_of_birth, location_region, bio, photo_urls"
    )
    .eq("is_active", true)
    .eq("profile_completed", true)
    .limit(50)
    .returns<PublicAnimalRow[]>();

  if (error) {
    console.error("Public animal listing query failed", { code: error.code });
    const permissionDenied = error.code === "42501";
    return NextResponse.json(
      {
        error: permissionDenied
          ? "Public animal listings are unavailable because anonymous read access is not enabled."
          : "Unable to load public animal listings.",
      },
      { status: permissionDenied ? 503 : 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Unable to load public animal listings." },
      { status: 500 }
    );
  }

  const animals = data.map(({ date_of_birth, ...animal }) => ({
    ...animal,
    age: getAge(date_of_birth),
  }));

  return NextResponse.json(animals);
}