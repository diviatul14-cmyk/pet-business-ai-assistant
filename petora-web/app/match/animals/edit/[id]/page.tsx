
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ui from "../../../match-dashboard.module.css";

type Animal = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null;
  location_region: string | null;
  bio: string | null;
  photo_urls: string[] | null;
  health_status: string | null;
  vaccination_status: string | null;
  vaccination_details: string | null;
  health_notes: string | null;
  profile_completed: boolean;
};

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 12,
  marginTop: 7,
  marginBottom: 18,
  border: "1px solid #dce5df",
  borderRadius: 9,
  fontSize: 15,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#244b37",
};

export default function EditAnimalPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("unknown");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  const [healthStatus, setHealthStatus] = useState("");
  const [vaccinationStatus, setVaccinationStatus] = useState("");
  const [vaccinationDetails, setVaccinationDetails] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);

  useEffect(() => {
    async function loadAnimal() {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.replace("/match/login");
        return;
      }

      const { data, error: loadError } = await supabase
        .from("animal_profiles")
        .select("*")
        .eq("id", id)
        .eq("owner_id", auth.user.id)
        .single();

      if (loadError || !data) {
        setError("Profile not found or you do not have permission to edit it.");
        setLoading(false);
        return;
      }

      const animal = data as Animal;

      setName(animal.name || "");
      setSpecies(animal.species || "Dog");
      setBreed(animal.breed || "");
      setSex(animal.sex || "unknown");
      setDateOfBirth(animal.date_of_birth || "");
      setLocation(animal.location_region || "");
      setBio(animal.bio || "");

      setHealthStatus(animal.health_status || "");
      setVaccinationStatus(animal.vaccination_status || "");
      setVaccinationDetails(animal.vaccination_details || "");
      setHealthNotes(animal.health_notes || "");
      setExistingPhotos(animal.photo_urls || []);

      setLoading(false);
    }

    loadAnimal();
  }, [id, router, supabase]);

  const completionItems = [
    Boolean(name.trim()),
    Boolean(species),
    Boolean(breed.trim()),
    Boolean(sex !== "unknown"),
    Boolean(dateOfBirth),
    Boolean(location.trim()),
    Boolean(bio.trim()),
    existingPhotos.length + newPhotos.length > 0,
    Boolean(healthStatus),
    Boolean(vaccinationStatus),
  ];

  const completedCount = completionItems.filter(Boolean).length;
  const completionPercent = Math.round(
    (completedCount / completionItems.length) * 100
  );

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Please log in again.");
      }

      if (!name.trim()) {
        throw new Error("Animal name is required.");
      }

      if (existingPhotos.length + newPhotos.length > 5) {
        throw new Error("A maximum of 5 photos is allowed.");
      }

      const uploadedPhotos: string[] = [];

      for (const photo of newPhotos) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
          throw new Error("Only JPG, PNG and WebP photos are allowed.");
        }

        if (photo.size > 5 * 1024 * 1024) {
          throw new Error("Each photo must be smaller than 5 MB.");
        }

        const safeName = photo.name.replace(/[^a-zA-Z0-9.-]/g, "-");
        const path = `${auth.user.id}/${id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("petora-match-photos")
          .upload(path, photo);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("petora-match-photos")
          .getPublicUrl(path);

        uploadedPhotos.push(publicData.publicUrl);
      }

      const finalPhotos = [...existingPhotos, ...uploadedPhotos];

      const requiredItems = [
        Boolean(name.trim()),
        Boolean(species),
        Boolean(breed.trim()),
        Boolean(sex !== "unknown"),
        Boolean(dateOfBirth),
        Boolean(location.trim()),
        Boolean(bio.trim()),
        finalPhotos.length > 0,
        Boolean(healthStatus),
        Boolean(vaccinationStatus),
      ];

      const isComplete = requiredItems.every(Boolean);

      const { error: updateError } = await supabase
        .from("animal_profiles")
        .update({
          name: name.trim(),
          species,
          breed: breed.trim() || null,
          sex,
          date_of_birth: dateOfBirth || null,
          location_region: location.trim() || null,
          bio: bio.trim() || null,
          photo_urls: finalPhotos,
          health_status: healthStatus || null,
          vaccination_status: vaccinationStatus || null,
          vaccination_details: vaccinationDetails.trim() || null,
          health_notes: healthNotes.trim() || null,
          profile_completed: isComplete,
        })
        .eq("id", id)
        .eq("owner_id", auth.user.id);

      if (updateError) throw updateError;

      setMessage("Profile saved successfully!");
      router.push("/match");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className={ui.animalFormPage}>
        <div className={ui.formStatusCard}>Loading animal profile...</div>
      </main>
    );
  }

  if (error && !name) {
    return (
      <main className={ui.animalFormPage}>
        <div className={ui.formStatusCard}>
          <p className={ui.formError} style={{ color: "#c0392b" }}>{error}</p>
          <button className={ui.formBackButton} onClick={() => router.push("/match")}>
            Back to PETORA Match
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={ui.animalFormPage}>
      <div className={ui.animalFormCard}>
        <button
          className={ui.formBackButton}
          type="button"
          onClick={() => router.push("/match")}
          style={{ marginBottom: 20 }}
        >
          ← Back to PETORA Match
        </button>

        <h1 style={{ color: "#174c35" }}>Edit Animal Profile</h1>

        <p style={{ color: "#66756c" }}>
          Keep your animal's information accurate and up to date.
        </p>

        <section className={ui.profileCompletion} style={{
          background: "#f5f8f5",
          borderRadius: 14,
          padding: 18,
          margin: "22px 0",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <strong>Profile completion</strong>
            <strong style={{ color: "#b18b43" }}>
              {completionPercent}%
            </strong>
          </div>

          <div style={{
            height: 9,
            background: "#e2e9e1",
            borderRadius: 20,
            marginTop: 12,
            overflow: "hidden",
          }}>
            <div style={{
              width: `${completionPercent}%`,
              height: "100%",
              background: "#1c6848",
              borderRadius: 20,
            }} />
          </div>

          <p style={{ fontSize: 12, color: "#718078", marginBottom: 0 }}>
            {completedCount} of 10 profile sections completed.
          </p>
        </section>

        <form onSubmit={handleSave}>
          <h2 style={{ color: "#174c35" }}>Basic information</h2>

          <label style={labelStyle}>Animal name *</label>
          <input required value={name}
            onChange={e => setName(e.target.value)}
            style={fieldStyle} />

          <label style={labelStyle}>Species *</label>
          <select value={species}
            onChange={e => setSpecies(e.target.value)}
            style={fieldStyle}>
            {["Dog", "Cat", "Bird", "Rabbit", "Horse", "Other"].map(item =>
              <option key={item}>{item}</option>
            )}
          </select>

          <label style={labelStyle}>Breed *</label>
          <input value={breed}
            onChange={e => setBreed(e.target.value)}
            placeholder="Enter breed"
            style={fieldStyle} />

          <label style={labelStyle}>Gender *</label>
          <select value={sex}
            onChange={e => setSex(e.target.value)}
            style={fieldStyle}>
            <option value="unknown">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <label style={labelStyle}>Date of birth *</label>
          <input type="date"
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            style={fieldStyle} />

          <label style={labelStyle}>Location *</label>
          <input value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="City or region"
            style={fieldStyle} />

          <label style={labelStyle}>About your animal *</label>
          <textarea value={bio}
            onChange={e => setBio(e.target.value)}
            rows={4}
            placeholder="Personality, temperament and other details..."
            style={{ ...fieldStyle, resize: "vertical" }} />

          <h2 style={{ color: "#174c35", marginTop: 30 }}>
            Health and vaccination
          </h2>

          <label style={labelStyle}>Health status *</label>
          <select value={healthStatus}
            onChange={e => setHealthStatus(e.target.value)}
            style={fieldStyle}>
            <option value="">Select health status</option>
            <option value="healthy">Owner reports healthy</option>
            <option value="under_treatment">Under veterinary treatment</option>
            <option value="recovery">Recovering</option>
            <option value="other">Other / needs discussion</option>
          </select>

          <label style={labelStyle}>Vaccination status *</label>
          <select value={vaccinationStatus}
            onChange={e => setVaccinationStatus(e.target.value)}
            style={fieldStyle}>
            <option value="">Select vaccination status</option>
            <option value="up_to_date">Owner reports up to date</option>
            <option value="partial">Partially vaccinated</option>
            <option value="not_vaccinated">Not vaccinated</option>
            <option value="unknown">Unknown</option>
          </select>

          <label style={labelStyle}>Vaccination details</label>
          <textarea value={vaccinationDetails}
            onChange={e => setVaccinationDetails(e.target.value)}
            rows={3}
            placeholder="Vaccine names and dates, if known..."
            style={{ ...fieldStyle, resize: "vertical" }} />

          <label style={labelStyle}>Additional health notes</label>
          <textarea value={healthNotes}
            onChange={e => setHealthNotes(e.target.value)}
            rows={4}
            placeholder="Allergies, medical history or other relevant information..."
            style={{ ...fieldStyle, resize: "vertical" }} />

          <h2 style={{ color: "#174c35", marginTop: 30 }}>
            Animal photos
          </h2>

          <div className={ui.profileGallery} style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}>
            {existingPhotos.map((url, index) => (
              <div key={url} style={{ position: "relative" }}>
                <img src={url}
                  alt={`${name} photo ${index + 1}`}
                  style={{
                    width: "100%",
                    height: 110,
                    objectFit: "cover",
                    borderRadius: 10,
                  }} />
                <button type="button"
                  onClick={() => setExistingPhotos(prev =>
                    prev.filter(photo => photo !== url)
                  )}
                  style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    border: 0,
                    borderRadius: "50%",
                    background: "#b92d2d",
                    color: "white",
                    width: 27,
                    height: 27,
                  }}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <label style={labelStyle}>Add new photos</label>
          <input type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={e => setNewPhotos(
              Array.from(e.target.files ?? []).slice(0, 5)
            )}
            style={{ ...fieldStyle, padding: 10 }} />

          <p style={{ color: "#718078", fontSize: 12 }}>
            Maximum 5 photos total. JPG, PNG or WebP, maximum 5 MB each.
          </p>

          {error && <p className={ui.formError} style={{ color: "#c0392b" }}>{error}</p>}
          {message && <p className={ui.formSuccess} style={{ color: "#187747" }}>{message}</p>}

          <button type="submit" disabled={saving}
            className={`${ui.formSubmit} ${ui.forestButton}`}
            style={{
              width: "100%",
              padding: 16,
              marginTop: 22,
              border: 0,
              borderRadius: 10,
              background: "#174c35",
              color: "white",
              fontWeight: 700,
              fontSize: 16,
              cursor: saving ? "wait" : "pointer",
            }}>
            {saving ? "Saving profile..." : "Save Profile Changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
