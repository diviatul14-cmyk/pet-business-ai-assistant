
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ui from "../../match-dashboard.module.css";

export default function NewAnimalPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("unknown");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Please log in before adding an animal.");
      }

      const user = authData.user;
      const animalId = crypto.randomUUID();
      const photoUrls: string[] = [];

      for (const photo of photos) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
          throw new Error("Only JPG, PNG and WebP photos are allowed.");
        }

        if (photo.size > 5 * 1024 * 1024) {
          throw new Error("Each photo must be smaller than 5 MB.");
        }

        const safeName = photo.name.replace(/[^a-zA-Z0-9.-]/g, "-");
        const path = `${user.id}/${animalId}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("petora-match-photos")
          .upload(path, photo);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("petora-match-photos")
          .getPublicUrl(path);

        photoUrls.push(publicData.publicUrl);
      }

      const { error: insertError } = await supabase
        .from("animal_profiles")
        .insert({
          id: animalId,
          owner_id: user.id,
          name: name.trim(),
          species,
          breed: breed.trim() || null,
          sex,
          date_of_birth: dateOfBirth || null,
          location_region: location.trim() || null,
          bio: bio.trim() || null,
          photo_urls: photoUrls,
        });

      if (insertError) throw insertError;
      setMessage("Animal profile created successfully!");
      router.push("/match");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={ui.animalFormPage}>
      <div className={ui.animalFormCard}>
        <button
          className={ui.formBackButton}
          type="button"
          onClick={() => router.push("/match")}
          style={{ marginBottom: 20, cursor: "pointer" }}
        >
          ← Back to PETORA Match
        </button>

        <h1 style={{ color: "#174c35", marginBottom: 8 }}>
          Add Your Animal
        </h1>

        <p style={{ color: "#66756c", marginBottom: 28 }}>
          Create a profile for responsible companion matching.
        </p>

        <form onSubmit={handleSubmit}>
          <label>Animal name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter animal name"
            style={fieldStyle}
          />

          <label>Species *</label>
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            style={fieldStyle}
          >
            <option>Dog</option>
            <option>Cat</option>
            <option>Bird</option>
            <option>Rabbit</option>
            <option>Horse</option>
            <option>Other</option>
          </select>

          <label>Breed</label>
          <input
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder="Enter breed"
            style={fieldStyle}
          />

          <label>Gender</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            style={fieldStyle}
          >
            <option value="unknown">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <label>Date of birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            style={fieldStyle}
          />

          <label>Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or region"
            style={fieldStyle}
          />

          <label>About your animal</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Personality, temperament and other details..."
            rows={4}
            style={{ ...fieldStyle, resize: "vertical" }}
          />

          <label>Animal photos (maximum 5)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              setPhotos(selected.slice(0, 5));
            }}
            style={{ ...fieldStyle, padding: 10 }}
          />

          <p style={{ color: "#718078", fontSize: 13 }}>
            JPG, PNG or WebP. Maximum 5 MB per photo.
            {photos.length > 0 && ` ${photos.length} photo(s) selected.`}
          </p>

          {error && (
            <p className={ui.formError} role="alert" style={{ color: "#c0392b" }}>{error}</p>
          )}

          {message && (
            <p className={ui.formSuccess} role="status" style={{ color: "#187747" }}>{message}</p>
          )}

          <button
            className={`${ui.formSubmit} ${ui.forestButton}`}
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 15,
              marginTop: 20,
              border: 0,
              borderRadius: 10,
              background: "#174c35",
              color: "white",
              fontWeight: 700,
              fontSize: 16,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Saving animal..." : "Create Animal Profile"}
          </button>
        </form>

      </div>
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 12,
  marginTop: 7,
  marginBottom: 20,
  border: "1px solid #dce5df",
  borderRadius: 9,
  fontSize: 15,
  boxSizing: "border-box",
};
