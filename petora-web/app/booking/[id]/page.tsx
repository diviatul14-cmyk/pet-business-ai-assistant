"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { useParams, useRouter } from "next/navigation";

type Pet = {

  pet_id?: string;

  id?: string;

  puppy_id?: string;

  category?: string;

  species?: string;

  breed?: string;

  name?: string;

  gender?: string;

  age?: string;

  price?: string | number;

  status?: string;

  vaccinated?: string;

  location?: string;

  photo?: string;

  image?: string;

  gallery_1?: string;

  gallery_2?: string;

  gallery_3?: string;

  gallery_4?: string;

  gallery_5?: string;

  description?: string;

};

declare global {

  interface Window {

    Razorpay: any;

  }

}

/* =========================================================

   HELPERS

========================================================= */

function clean(value: unknown): string {

  if (value === null || value === undefined) return "";

  return String(value).trim();

}

function getErrorMessage(error: unknown): string {

  if (error instanceof Error && error.message) {

    return error.message;

  }

  if (typeof error === "string" && error.trim()) {

    return error.trim();

  }

  if (error && typeof error === "object") {

    const obj = error as Record<string, unknown>;

    if (typeof obj.message === "string" && obj.message.trim()) {

      return obj.message.trim();

    }

    if (typeof obj.error === "string" && obj.error.trim()) {

      return obj.error.trim();

    }

    if (

      obj.error &&

      typeof obj.error === "object" &&

      typeof (obj.error as Record<string, unknown>).message === "string"

    ) {

      return String(

        (obj.error as Record<string, unknown>).message

      ).trim();

    }

    try {

      const json = JSON.stringify(error);

      if (json && json !== "{}") {

        return json;

      }

    } catch {

      // Ignore JSON conversion errors.

    }

  }

  return "Something went wrong. Please try again.";

}

/*

  Google Sheet currently stores values such as:

      images/ST001.jpg

  But the actual file is:

      public/ST001.jpg

  Therefore the browser URL must be:

      /ST001.jpg

*/

function getImageUrl(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";

  // Keep externally hosted images unchanged.
  if (/^(https?:|data:image\/)/i.test(raw)) return raw;

  // Google Sheets may contain paths such as:
  // /ST001-images/ST001-1.jpg, public/ST001-images/ST001-1.jpg,
  // or images/ST001.jpg. Next.js serves files from /public at the URL root.
  let path = raw.replace(/\\/g, "/").trim();
  path = path.replace(/^\/+/, "");
  path = path.replace(/^public\//i, "");
  path = path.replace(/^images\//i, "");

  if (!path || path.split("/").some((part) => part === "..")) return "";
  return `/${path}`;
}

function getPetId(pet: Pet): string {

  return clean(pet.pet_id || pet.id || pet.puppy_id);

}

function getPetName(pet: Pet): string {

  return clean(pet.name) || "Pet";

}

function getBreed(pet: Pet): string {

  return clean(pet.breed) || clean(pet.species) || "Companion";

}

function getNumericPrice(value: unknown): number {

  if (typeof value === "number" && Number.isFinite(value)) {

    return Math.round(value);

  }

  const raw = clean(value);

  if (!raw) return 0;

  const cleaned = raw.replace(/[₹,\s]/g, "");

  const number = Number(cleaned);

  if (!Number.isFinite(number)) return 0;

  return Math.round(number);

}

function formatPrice(value: number): string {

  return new Intl.NumberFormat("en-IN", {

    maximumFractionDigits: 0,

  }).format(value);

}

/* =========================================================

   PAGE

========================================================= */

export default function BookingPage() {

  const params = useParams();

  const router = useRouter();

  const id = clean(params?.id);

  const [pet, setPet] = useState<Pet | null>(null);

  const [loading, setLoading] = useState(true);

  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState("");

  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");

  const [location, setLocation] = useState("");

  const [imageFailed, setImageFailed] = useState(false);

  const [selectedImageUrl, setSelectedImageUrl] = useState("");

  /* =======================================================

     LOAD PET

  ======================================================= */

  useEffect(() => {

    let cancelled = false;

    async function loadPet() {

      try {

        setLoading(true);

        setError("");

        const response = await fetch("/api/pets", {

          cache: "no-store",

        });

        if (!response.ok) {

          throw new Error(

            `Unable to load pet information (${response.status}).`

          );

        }

        const data = await response.json();

        let pets: Pet[] = [];

        if (Array.isArray(data)) {

          pets = data;

        } else if (Array.isArray(data?.pets)) {

          pets = data.pets;

        } else if (Array.isArray(data?.data)) {

          pets = data.data;

        } else {

          throw new Error(

            "The pet inventory response was not in the expected format."

          );

        }

        const wantedId = id.toLowerCase();

        const found = pets.find((item) => {

          const itemId = getPetId(item).toLowerCase();

          return itemId === wantedId;

        });

        if (!found) {

          throw new Error(

            `Pet "${id}" was not found in the inventory.`

          );

        }

        if (!cancelled) {

          setPet(found);

          setImageFailed(false);

        }

      } catch (err) {

        if (!cancelled) {

          setError(getErrorMessage(err));

        }

      } finally {

        if (!cancelled) {

          setLoading(false);

        }

      }

    }

    if (id) {

      loadPet();

    } else {

      setLoading(false);

      setError("No pet ID was provided.");

    }

    return () => {

      cancelled = true;

    };

  }, [id]);

  /* =======================================================

     IMAGE

  ======================================================= */

  const galleryImages = useMemo(() => {

    if (!pet) return [] as string[];

    const petId = getPetId(pet);

    // Prefer image paths saved in the Inventory sheet. If the API
    // does not return gallery columns yet, use the known public folder
    // convention: /PETID-images/PETID-1.jpg through PETID-5.jpg.
    const savedPaths = [
      pet.photo,
      pet.image,
      pet.gallery_1,
      pet.gallery_2,
      pet.gallery_3,
      pet.gallery_4,
      pet.gallery_5,
    ];

    const derivedPaths = petId
      ? [1, 2, 3, 4, 5].map(
          (number) => `/${petId}-images/${petId}-${number}.jpg`
        )
      : [];

    return Array.from(
      new Set(
        [...savedPaths, ...derivedPaths]
          .map((path) => getImageUrl(path))
          .filter(Boolean)
      )
    );

  }, [pet]);

  const imageUrl = selectedImageUrl || galleryImages[0] || "";

  useEffect(() => {
    setSelectedImageUrl("");
    setImageFailed(false);
  }, [id, pet]);

  /* =======================================================

     RAZORPAY SCRIPT

  ======================================================= */

  useEffect(() => {

    if (typeof window === "undefined") return;

    if (document.getElementById("razorpay-checkout-js")) {

      return;

    }

    const script = document.createElement("script");

    script.id = "razorpay-checkout-js";

    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    document.body.appendChild(script);

    return () => {

      // Do not remove the script.

      // Other pages can reuse it.

    };

  }, []);

  /* =======================================================

     PAYMENT

  ======================================================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!pet) {

      setError("Pet information is not available.");

      return;

    }

    const petId = getPetId(pet);

    if (!petId) {

      setError("Pet ID is missing.");

      return;

    }

    if (!fullName.trim()) {

      setError("Please enter your full name.");

      return;

    }

    if (!phone.trim()) {

      setError("Please enter your phone number.");

      return;

    }

    if (!email.trim()) {

      setError("Please enter your email address.");

      return;

    }

    if (!location.trim()) {

      setError("Please enter your location.");

      return;

    }

    setProcessing(true);

    setError("");

    try {

      /*

        IMPORTANT:

        We send the PET ID, not the price.

        The server reads the current price directly

        from Google Sheets Inventory.

      */

      const createResponse = await fetch(

        "/api/payment/create-order",

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            pet_id: petId,

            customer_name: fullName.trim(),

            phone: phone.trim(),

            email: email.trim(),

            location: location.trim(),

          }),

        }

      );

      const createText = await createResponse.text();

      let createData: any;

      try {

        createData = JSON.parse(createText);

      } catch {

        throw new Error(

          createText ||

            `Unable to create payment order (${createResponse.status}).`

        );

      }

      if (!createResponse.ok || !createData?.success) {

        throw new Error(

          getErrorMessage(

            createData?.error ||

              createData?.message ||

              "Unable to create Razorpay order."

          )

        );

      }

      const orderId = clean(createData.order_id);

      const keyId = clean(createData.key_id);

      if (!orderId) {

        throw new Error(

          "Razorpay order ID was not returned by the server."

        );

      }

      if (!keyId) {

        throw new Error(

          "Razorpay Key ID was not returned by the server."

        );

      }

      /*

        The server returns the authoritative price.

      */

      const serverAmount = Number(createData.amount);

      if (!Number.isFinite(serverAmount) || serverAmount <= 0) {

        throw new Error(

          "Invalid payment amount received from the server."

        );

      }

      /*

        Make sure Razorpay Checkout has loaded.

      */

      if (!window.Razorpay) {

        await new Promise<void>((resolve, reject) => {

          const started = Date.now();

          const timer = window.setInterval(() => {

            if (window.Razorpay) {

              window.clearInterval(timer);

              resolve();

              return;

            }

            if (Date.now() - started > 10000) {

              window.clearInterval(timer);

              reject(

                new Error(

                  "Razorpay Checkout could not be loaded. Please refresh and try again."

                )

              );

            }

          }, 200);

        });

      }

      const amountInRupees = Math.round(serverAmount / 100);

      const options = {

        key: keyId,

        amount: serverAmount,

        currency: clean(createData.currency) || "INR",

        name: "PETORA™",

        description: `Full purchase of ${getPetName(

          pet

        )} - ${getBreed(pet)}`,

        order_id: orderId,

        prefill: {

          name: fullName.trim(),

          email: email.trim(),

          contact: phone.trim(),

        },

        notes: {

          pet_id: petId,

          customer_name: fullName.trim(),

          location: location.trim(),

        },

        theme: {

          color: "#006b57",

        },

        modal: {

          ondismiss: () => {

            setProcessing(false);

          },

        },

        handler: async function (paymentResponse: any) {

          try {

            setProcessing(true);

            setError("");

            const verifyResponse = await fetch(

              "/api/payment/verify",

              {

                method: "POST",

                headers: {

                  "Content-Type": "application/json",

                },

                body: JSON.stringify({

                  pet_id: petId,

                  customer_name: fullName.trim(),

                  phone: phone.trim(),

                  email: email.trim(),

                  location: location.trim(),

                  razorpay_order_id:

                    paymentResponse?.razorpay_order_id,

                  razorpay_payment_id:

                    paymentResponse?.razorpay_payment_id,

                  razorpay_signature:

                    paymentResponse?.razorpay_signature,

                }),

              }

            );

            const verifyText = await verifyResponse.text();

            let verifyData: any;

            try {

              verifyData = JSON.parse(verifyText);

            } catch {

              throw new Error(

                verifyText ||

                  `Payment verification failed (${verifyResponse.status}).`

              );

            }

            if (

              !verifyResponse.ok ||

              !verifyData?.success ||

              !verifyData?.booking_confirmed

            ) {

              throw new Error(

                getErrorMessage(

                  verifyData?.error ||

                    verifyData?.message ||

                    "Payment verification failed."

                )

              );

            }

            setSuccess(true);

            setProcessing(false);

          } catch (err) {

            setProcessing(false);

            setError(

              `Payment was received, but confirmation could not be completed: ${getErrorMessage(

                err

              )}`

            );

          }

        },

      };

      const checkout = new window.Razorpay(options);

      checkout.on(

        "payment.failed",

        function (response: any) {

          const reason =

            response?.error?.description ||

            response?.error?.reason ||

            response?.error?.code ||

            "Payment failed. Please try again.";

          setProcessing(false);

          setError(getErrorMessage(reason));

        }

      );

      checkout.open();

      /*

        amountInRupees is intentionally calculated only

        for validation/debug readability.

        The actual amount sent to Razorpay is serverAmount.

      */

      void amountInRupees;

    } catch (err) {

      setProcessing(false);

      setError(getErrorMessage(err));

    }

  }

  /* =======================================================

     LOADING

  ======================================================= */

  if (loading) {

    return (

      <main className="booking-page">

        <div className="loading-card">

          <div className="loading-mark">🐾</div>

          <h2>Loading companion...</h2>

          <p>

            Please wait while PETORA loads the latest

            inventory information.

          </p>

        </div>

        <style jsx>{`

          .booking-page {

            min-height: 100vh;

            background: #f4f7f2;

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 40px 20px;

            font-family:

              Arial,

              Helvetica,

              sans-serif;

          }

          .loading-card {

            width: min(520px, 100%);

            background: white;

            border-radius: 28px;

            padding: 50px 35px;

            text-align: center;

            box-shadow: 0 20px 60px rgba(0, 50, 40, 0.08);

          }

          .loading-mark {

            width: 70px;

            height: 70px;

            border-radius: 50%;

            background: #edf5f0;

            display: flex;

            align-items: center;

            justify-content: center;

            margin: 0 auto 20px;

            font-size: 30px;

          }

          h2 {

            margin: 0 0 10px;

            color: #005c4b;

          }

          p {

            margin: 0;

            color: #6d7c75;

            line-height: 1.6;

          }

        `}</style>

      </main>

    );

  }

  /* =======================================================

     SUCCESS

  ======================================================= */

  if (success && pet) {

    return (

      <main className="booking-page">

        <div className="success-card">

          <div className="success-icon">✓</div>

          <div className="eyebrow">

            PETORA PURCHASE

          </div>

          <h1>Payment Successful</h1>

          <p className="success-main">

            Your full payment for{" "}

            <strong>{getPetName(pet)}</strong> has

            been successfully verified.

          </p>

          <div className="confirmation-box">

            <div>

              <span>COMPANION</span>

              <strong>{getPetName(pet)}</strong>

            </div>

            <div>

              <span>BREED</span>

              <strong>{getBreed(pet)}</strong>

            </div>

            <div>

              <span>AMOUNT PAID</span>

              <strong>

                ₹

                {formatPrice(

                  getNumericPrice(pet.price)

                )}

              </strong>

            </div>

            <div>

              <span>STATUS</span>

              <strong>CAPTURED ✓</strong>

            </div>

          </div>

          <p className="next-step">

            PETORA has recorded your purchase

            successfully. Our team will contact you

            using the details provided during checkout.

          </p>

          <button

            type="button"

            onClick={() => router.push("/")}

          >

            Return to PETORA →

          </button>

        </div>

        <style jsx>{`

          .booking-page {

            min-height: 100vh;

            background: #f4f7f2;

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 50px 20px;

            font-family:

              Arial,

              Helvetica,

              sans-serif;

          }

          .success-card {

            width: min(700px, 100%);

            background: white;

            border-radius: 30px;

            padding: 55px;

            text-align: center;

            box-shadow: 0 25px 80px rgba(0, 70, 55, 0.1);

          }

          .success-icon {

            width: 78px;

            height: 78px;

            margin: 0 auto 25px;

            border-radius: 50%;

            background: #006b57;

            color: white;

            display: flex;

            align-items: center;

            justify-content: center;

            font-size: 42px;

            font-weight: 700;

          }

          .eyebrow {

            color: #bd8c32;

            letter-spacing: 3px;

            font-size: 12px;

            font-weight: 800;

          }

          h1 {

            color: #005c4b;

            font-size: 46px;

            margin: 10px 0 15px;

          }

          .success-main {

            color: #66766f;

            font-size: 17px;

            line-height: 1.7;

            margin: 0 auto 30px;

          }

          .confirmation-box {

            background: #edf5f0;

            border-radius: 20px;

            padding: 24px;

            display: grid;

            grid-template-columns: 1fr 1fr;

            gap: 18px;

            text-align: left;

          }

          .confirmation-box div {

            display: flex;

            flex-direction: column;

            gap: 6px;

          }

          .confirmation-box span {

            color: #83928b;

            font-size: 10px;

            letter-spacing: 1.5px;

            font-weight: 800;

          }

          .confirmation-box strong {

            color: #005c4b;

            font-size: 15px;

          }

          .next-step {

            color: #687871;

            line-height: 1.7;

            margin: 25px 0;

          }

          button {

            border: 0;

            background: #006b57;

            color: white;

            padding: 16px 28px;

            border-radius: 12px;

            font-size: 15px;

            font-weight: 800;

            cursor: pointer;

          }

          @media (max-width: 600px) {

            .success-card {

              padding: 35px 22px;

            }

            h1 {

              font-size: 34px;

            }

            .confirmation-box {

              grid-template-columns: 1fr;

            }

          }

        `}</style>

      </main>

    );

  }

  /* =======================================================

     ERROR WITHOUT PET

  ======================================================= */

  if (!pet) {

    return (

      <main className="booking-page">

        <div className="error-card">

          <div className="error-icon">!</div>

          <h1>Unable to load companion</h1>

          <p>

            {error ||

              "The requested companion could not be found."}

          </p>

          <button

            type="button"

            onClick={() => router.push("/")}

          >

            ← Back to PETORA

          </button>

        </div>

        <style jsx>{`

          .booking-page {

            min-height: 100vh;

            background: #f4f7f2;

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 40px 20px;

            font-family:

              Arial,

              Helvetica,

              sans-serif;

          }

          .error-card {

            width: min(560px, 100%);

            background: white;

            border-radius: 28px;

            padding: 45px;

            text-align: center;

            box-shadow: 0 20px 60px rgba(0, 50, 40, 0.08);

          }

          .error-icon {

            width: 64px;

            height: 64px;

            border-radius: 50%;

            background: #fff0ee;

            color: #c54b3f;

            display: flex;

            align-items: center;

            justify-content: center;

            margin: 0 auto 20px;

            font-size: 28px;

            font-weight: 800;

          }

          h1 {

            color: #005c4b;

            margin: 0 0 15px;

          }

          p {

            color: #c54b3f;

            line-height: 1.6;

            margin-bottom: 25px;

          }

          button {

            border: 0;

            background: #006b57;

            color: white;

            padding: 14px 25px;

            border-radius: 12px;

            font-weight: 800;

            cursor: pointer;

          }

        `}</style>

      </main>

    );

  }

  /* =======================================================

     MAIN BOOKING PAGE

  ======================================================= */

  const petName = getPetName(pet);

  const breed = getBreed(pet);

  const petId = getPetId(pet);

  const price = getNumericPrice(pet.price);

  const status = clean(pet.status);

  const available =

    !status ||

    status.toLowerCase() === "available";

  return (

    <main className="booking-page">

      <div className="topbar">

        <button

          type="button"

          className="back-button"

          onClick={() => router.back()}

        >

          ← Back

        </button>

        <div className="brand">

          <div className="brand-name">

            PETORA™

          </div>

          <div className="brand-tagline">

            PETS BEYOND BORDERS

          </div>

        </div>

      </div>

      <section className="booking-card">

        {/* =================================================

            IMAGE PANEL

        ================================================= */}

        <div className="image-panel">

          <div className="availability">

            ✓ {available ? "AVAILABLE" : "UNAVAILABLE"}

          </div>

          {!imageFailed && imageUrl ? (

            <img

              key={imageUrl}

              src={imageUrl}

              alt={`${petName} - ${breed}`}

              className="pet-image"

              onError={() => {

                console.error("PETORA image failed:", imageUrl);

                setImageFailed(true);

              }}

            />

          ) : (

            <div className="image-fallback">

              <div className="fallback-paw">

                🐾

              </div>

              <div className="fallback-name">

                {petName}

              </div>

              <div className="fallback-breed">

                {breed}

              </div>

            </div>

          )}

          {galleryImages.length > 1 && (
            <div className="pet-gallery" aria-label="Pet photo gallery">
              {galleryImages.slice(0, 5).map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  className={`gallery-thumb${imageUrl === src ? " active" : ""}`}
                  onClick={() => {
                    setSelectedImageUrl(src);
                    setImageFailed(false);
                  }}
                  aria-label={`View pet photo ${index + 1}`}
                  aria-pressed={imageUrl === src}
                >
                  <img
                    src={src}
                    alt={`${petName} photo ${index + 1}`}
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                  />
                </button>
              ))}
            </div>
          )}

        </div>

        {/* =================================================

            DETAILS / PAYMENT PANEL

        ================================================= */}

        <div className="details-panel">

          <div className="eyebrow">

            PETORA PURCHASE

          </div>

          <h1>{petName}</h1>

          <div className="subtitle">

            {breed} · {petId}

          </div>

          {/* PRICE */}

          <div className="price-card">

            <div className="price-label">

              TOTAL PURCHASE PRICE

            </div>

            <div className="price">

              ₹{formatPrice(price)}

            </div>

            <div className="price-note">

              Full payment · No booking deposit

            </div>

          </div>

          {/* PET INFORMATION */}

          <div className="info-grid">

            <div className="info-box">

              <span>GENDER</span>

              <strong>

                {clean(pet.gender) || "—"}

              </strong>

            </div>

            <div className="info-box">

              <span>AGE</span>

              <strong>

                {clean(pet.age) || "—"}

              </strong>

            </div>

            <div className="info-box">

              <span>LOCATION</span>

              <strong>

                {clean(pet.location) || "—"}

              </strong>

            </div>

            <div className="info-box">

              <span>VACCINATED</span>

              <strong>

                {clean(pet.vaccinated) || "—"}

              </strong>

            </div>

          </div>

          {/* ERROR */}

          {error ? (

            <div className="error-message">

              {error}

            </div>

          ) : null}

          {/* FORM */}

          <form onSubmit={handleSubmit}>

            <div className="two-fields">

              <div className="field">

                <label htmlFor="fullName">

                  Full Name

                </label>

                <input

                  id="fullName"

                  type="text"

                  value={fullName}

                  onChange={(event) =>

                    setFullName(event.target.value)

                  }

                  placeholder="Your full name"

                  autoComplete="name"

                  disabled={processing}

                />

              </div>

              <div className="field">

                <label htmlFor="phone">

                  Phone

                </label>

                <input

                  id="phone"

                  type="tel"

                  value={phone}

                  onChange={(event) =>

                    setPhone(event.target.value)

                  }

                  placeholder="+91 XXXXX XXXXX"

                  autoComplete="tel"

                  disabled={processing}

                />

              </div>

            </div>

            <div className="field">

              <label htmlFor="email">

                Email

              </label>

              <input

                id="email"

                type="email"

                value={email}

                onChange={(event) =>

                  setEmail(event.target.value)

                }

                placeholder="you@example.com"

                autoComplete="email"

                disabled={processing}

              />

            </div>

            <div className="field">

              <label htmlFor="location">

                Location

              </label>

              <input

                id="location"

                type="text"

                value={location}

                onChange={(event) =>

                  setLocation(event.target.value)

                }

                placeholder="City, State"

                autoComplete="address-level2"

                disabled={processing}

              />

            </div>

            <button

              type="submit"

              className="pay-button"

              disabled={

                processing ||

                !available ||

                price <= 0

              }

            >

              {processing

                ? "Processing..."

                : `Pay ₹${formatPrice(

                    price

                  )} & Confirm Purchase →`}

            </button>

            <p className="secure-note">

              You will be redirected to Razorpay's

              secure checkout to complete the full

              purchase payment.

            </p>

            <div className="payment-note">

              <span>✓</span>

              <div>

                <strong>100% secure payment</strong>

                <small>

                  Full product price is taken from

                  the PETORA Inventory.

                </small>

              </div>

            </div>

          </form>

        </div>

      </section>

      <style jsx>{`

        * {

          box-sizing: border-box;

        }

        .booking-page {

          min-height: 100vh;

          background: #f4f7f2;

          padding: 35px 5vw 60px;

          font-family:

            Arial,

            Helvetica,

            sans-serif;

          color: #005c4b;

        }

        .topbar {

          max-width: 1280px;

          margin: 0 auto 28px;

          display: flex;

          align-items: center;

          justify-content: space-between;

        }

        .back-button {

          border: 0;

          background: transparent;

          color: #005c4b;

          font-size: 16px;

          font-weight: 700;

          padding: 8px 0;

          cursor: pointer;

        }

        .brand {

          text-align: right;

        }

        .brand-name {

          color: #005c4b;

          font-size: 24px;

          font-weight: 900;

          letter-spacing: -1px;

        }

        .brand-tagline {

          color: #bd8c32;

          font-size: 8px;

          letter-spacing: 2px;

          font-weight: 800;

          margin-top: 2px;

        }

        .booking-card {

          max-width: 1280px;

          margin: 0 auto;

          background: white;

          border-radius: 30px;

          overflow: hidden;

          display: grid;

          grid-template-columns: minmax(0, 1fr) minmax(

              0,

              0.9fr

            );

          box-shadow: 0 25px 80px

            rgba(0, 60, 45, 0.08);

        }

        /* IMAGE */

        .image-panel {

          min-height: 690px;

          position: relative;

          background: #edf4ef;

          overflow: hidden;

        }

        .availability {

          position: absolute;

          z-index: 3;

          top: 24px;

          left: 24px;

          background: white;

          color: #006b57;

          border-radius: 999px;

          padding: 10px 15px;

          font-size: 12px;

          font-weight: 900;

          letter-spacing: 0.4px;

          box-shadow: 0 8px 25px

            rgba(0, 50, 40, 0.08);

        }

        .pet-image {

          position: absolute;

          inset: 0;

          width: 100%;

          height: 100%;

          min-height: 690px;

          display: block;

          object-fit: cover;

          object-position: center;

        }

        .pet-gallery {
          position: absolute;
          z-index: 4;
          left: 18px;
          right: 18px;
          bottom: 18px;
          display: flex;
          gap: 10px;
          padding: 10px;
          overflow-x: auto;
          border: 1px solid rgba(255, 255, 255, 0.75);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(10px);
        }

        .gallery-thumb {
          flex: 0 0 76px;
          width: 76px;
          height: 66px;
          padding: 0;
          overflow: hidden;
          border: 2px solid transparent;
          border-radius: 10px;
          background: #edf4ef;
          cursor: pointer;
        }

        .gallery-thumb.active {
          border-color: #006b57;
          box-shadow: 0 0 0 2px rgba(0, 107, 87, 0.14);
        }

        .gallery-thumb img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .image-fallback {

          position: absolute;

          inset: 0;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-direction: column;

          background: #edf4ef;

          text-align: center;

        }

        .fallback-paw {

          width: 95px;

          height: 95px;

          border-radius: 50%;

          background: white;

          display: flex;

          align-items: center;

          justify-content: center;

          font-size: 42px;

          margin-bottom: 20px;

          box-shadow: 0 10px 35px

            rgba(0, 60, 45, 0.08);

        }

        .fallback-name {

          color: #005c4b;

          font-size: 30px;

          font-weight: 900;

        }

        .fallback-breed {

          color: #718078;

          margin-top: 6px;

          font-size: 16px;

        }

        /* DETAILS */

        .details-panel {

          padding: 48px 42px 45px;

          min-width: 0;

        }

        .eyebrow {

          color: #bd8c32;

          font-size: 11px;

          font-weight: 900;

          letter-spacing: 2.2px;

          margin-bottom: 8px;

        }

        h1 {

          color: #005c4b;

          font-size: clamp(44px, 5vw, 60px);

          line-height: 1;

          letter-spacing: -2px;

          margin: 0;

        }

        .subtitle {

          color: #708078;

          font-size: 17px;

          font-weight: 700;

          margin-top: 9px;

        }

        .price-card {

          background: #edf5f0;

          border: 1px solid #dcebe3;

          border-radius: 20px;

          padding: 24px 22px;

          margin-top: 35px;

        }

        .price-label {

          color: #7c8c84;

          font-size: 11px;

          letter-spacing: 1.5px;

          font-weight: 900;

        }

        .price {

          color: #006b57;

          font-size: 38px;

          line-height: 1;

          font-weight: 900;

          letter-spacing: -1px;

          margin-top: 10px;

        }

        .price-note {

          color: #718078;

          font-size: 13px;

          font-weight: 700;

          margin-top: 9px;

        }

        .info-grid {

          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 10px;

          margin-top: 25px;

          margin-bottom: 24px;

        }

        .info-box {

          background: #f7f9f7;

          border-radius: 14px;

          padding: 15px 14px;

          min-width: 0;

        }

        .info-box span {

          display: block;

          color: #87938d;

          font-size: 9px;

          letter-spacing: 1.2px;

          font-weight: 900;

          margin-bottom: 6px;

        }

        .info-box strong {

          display: block;

          color: #006451;

          font-size: 14px;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: ellipsis;

        }

        .error-message {

          background: #fff0ee;

          color: #c64d42;

          border: 1px solid #ffd4cf;

          border-radius: 12px;

          padding: 13px 15px;

          margin-bottom: 18px;

          font-size: 13px;

          font-weight: 700;

          line-height: 1.5;

          overflow-wrap: anywhere;

        }

        form {

          width: 100%;

        }

        .two-fields {

          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 12px;

        }

        .field {

          margin-bottom: 13px;

        }

        label {

          display: block;

          color: #005c4b;

          font-size: 11px;

          font-weight: 900;

          margin-bottom: 7px;

        }

        input {

          width: 100%;

          height: 51px;

          border: 1px solid #dce5df;

          border-radius: 12px;

          background: white;

          color: #183c32;

          padding: 0 14px;

          font-size: 14px;

          outline: none;

          transition:

            border-color 0.2s ease,

            box-shadow 0.2s ease;

        }

        input::placeholder {

          color: #a5aea9;

        }

        input:focus {

          border-color: #006b57;

          box-shadow: 0 0 0 3px

            rgba(0, 107, 87, 0.08);

        }

        input:disabled {

          background: #f7f8f7;

          cursor: not-allowed;

        }

        .pay-button {

          width: 100%;

          min-height: 57px;

          border: 0;

          border-radius: 13px;

          background: #006b57;

          color: white;

          font-size: 15px;

          font-weight: 900;

          cursor: pointer;

          margin-top: 5px;

          box-shadow: 0 10px 25px

            rgba(0, 107, 87, 0.15);

          transition:

            transform 0.15s ease,

            opacity 0.15s ease;

        }

        .pay-button:hover:not(:disabled) {

          transform: translateY(-1px);

        }

        .pay-button:disabled {

          opacity: 0.6;

          cursor: not-allowed;

        }

        .secure-note {

          color: #7b8882;

          font-size: 12px;

          line-height: 1.55;

          margin: 13px 0 0;

        }

        .payment-note {

          display: flex;

          gap: 10px;

          align-items: flex-start;

          background: #f8faf8;

          border-radius: 12px;

          padding: 13px;

          margin-top: 17px;

        }

        .payment-note > span {

          width: 22px;

          height: 22px;

          border-radius: 50%;

          background: #006b57;

          color: white;

          display: flex;

          align-items: center;

          justify-content: center;

          font-size: 12px;

          font-weight: 900;

          flex: 0 0 auto;

        }

        .payment-note strong {

          display: block;

          color: #005c4b;

          font-size: 12px;

          margin-bottom: 3px;

        }

        .payment-note small {

          display: block;

          color: #7d8984;

          font-size: 10px;

          line-height: 1.4;

        }

        @media (max-width: 1000px) {

          .booking-card {

            grid-template-columns: 1fr;

          }

          .image-panel {

            min-height: 520px;

          }

          .pet-image {

            min-height: 520px;

          }

          .details-panel {

            padding: 40px 35px;

          }

        }

        @media (max-width: 600px) {

          .booking-page {

            padding: 20px 14px 35px;

          }

          .topbar {

            margin-bottom: 18px;

          }

          .brand-name {

            font-size: 19px;

          }

          .brand-tagline {

            font-size: 6px;

          }

          .booking-card {

            border-radius: 22px;

          }

          .image-panel {

            min-height: 400px;

          }

          .pet-image {

            min-height: 400px;

          }

          .details-panel {

            padding: 30px 20px;

          }

          h1 {

            font-size: 42px;

          }

          .price {

            font-size: 34px;

          }

          .two-fields {

            grid-template-columns: 1fr;

            gap: 0;

          }

          .info-grid {

            gap: 8px;

          }

          .info-box {

            padding: 13px 11px;

          }

        }

      `}</style>

    </main>

  );

}