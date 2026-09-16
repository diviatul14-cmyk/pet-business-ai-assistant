"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Pet = {
  pet_id?: string;
  id?: string;
  name?: string;
  breed?: string;
  price?: string | number;
  photo?: string;
  image?: string;
  status?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function formatINR(value: unknown): string {
  const number = Number(
    String(value ?? "")
      .replace(/[₹,\s]/g, "")
      .trim()
  );

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return `₹${number.toLocaleString("en-IN")}`;
}

function getPetId(pet: Pet | null): string {
  return clean(pet?.pet_id || pet?.id);
}

export default function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [petId, setPetId] = useState("");
  const [pet, setPet] = useState<Pet | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const resolvedParams = await params;
        const id = clean(resolvedParams.id);

        if (!active) return;

        setPetId(id);

        const response = await fetch("/api/pets", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load PETORA inventory.");
        }

        const data = await response.json();

        const list: Pet[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.pets)
          ? data.pets
          : Array.isArray(data?.inventory)
          ? data.inventory
          : [];

        const found = list.find(
          (item) =>
            clean(item?.pet_id) === id ||
            clean(item?.id) === id
        );

        if (!found) {
          throw new Error("Pet not found in PETORA inventory.");
        }

        if (active) {
          setPet(found);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this pet."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [params]);

  async function loadRazorpay(): Promise<boolean> {
    if (window.Razorpay) {
      return true;
    }

    return new Promise((resolve) => {
      const existing = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(true));
        existing.addEventListener("error", () => resolve(false));
        return;
      }

      const script = document.createElement("script");

      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";

      script.async = true;

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  }

  async function startPayment() {
    setError("");

    if (!pet) {
      setError("Pet information is not available.");
      return;
    }

    if (!name.trim()) {
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

    setPaying(true);

    try {
      const razorpayLoaded = await loadRazorpay();

      if (!razorpayLoaded) {
        throw new Error(
          "Razorpay Checkout could not be loaded. Please try again."
        );
      }

      /*
       * IMPORTANT:
       * We send ONLY the pet ID.
       *
       * The server reads the actual price from
       * the PETORA Inventory sheet.
       *
       * The customer/browser cannot choose the amount.
       */
      const orderResponse = await fetch(
        "/api/payment/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pet_id: petId,
            customer_name: name.trim(),
            customer_phone: phone.trim(),
            customer_email: email.trim(),
          }),
        }
      );

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(
          orderData?.details ||
            orderData?.error ||
            "Unable to create the Razorpay payment order."
        );
      }

      if (!orderData?.order_id) {
        throw new Error(
          "Razorpay order ID was not returned."
        );
      }

      if (!orderData?.key_id) {
        throw new Error(
          "Razorpay key ID was not returned by the server."
        );
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "PETORA™",
        description: `Full payment for ${
          orderData?.pet?.name || pet.name || petId
        }`,
        order_id: orderData.order_id,

        prefill: {
          name: name.trim(),
          email: email.trim(),
          contact: phone.trim(),
        },

        notes: {
          pet_id: petId,
        },

        theme: {
          color: "#07513f",
        },

        handler: async function (paymentResponse: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyResponse = await fetch(
              "/api/payment/verify",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  pet_id: petId,
                  customer_name: name.trim(),
                  customer_phone: phone.trim(),
                  customer_email: email.trim(),
                  razorpay_payment_id:
                    paymentResponse.razorpay_payment_id,
                  razorpay_order_id:
                    paymentResponse.razorpay_order_id,
                  razorpay_signature:
                    paymentResponse.razorpay_signature,
                }),
              }
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(
                verifyData?.details ||
                  verifyData?.error ||
                  "Payment verification failed."
              );
            }

            setSuccess(true);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Payment verification failed."
            );
          } finally {
            setPaying(false);
          }
        },

        modal: {
          ondismiss: function () {
            setPaying(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on(
        "payment.failed",
        function (response: any) {
          setPaying(false);

          setError(
            response?.error?.description ||
              "Payment failed. Please try again."
          );
        }
      );

      razorpay.open();
    } catch (err) {
      setPaying(false);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to start payment."
      );
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "40px 20px",
          background: "#f5f7f3",
        }}
      >
        <p style={{ color: "#07513f", fontWeight: 700 }}>
          Loading PETORA companion...
        </p>
      </main>
    );
  }

  if (error && !pet) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "80px 20px",
          background: "#f5f7f3",
        }}
      >
        <div
          style={{
            maxWidth: "700px",
            margin: "0 auto",
            background: "#fff",
            borderRadius: "24px",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <h1 style={{ color: "#07513f" }}>
            PETORA
          </h1>

          <p>{error}</p>

          <Link
            href="/category/dogs"
            style={{
              display: "inline-block",
              marginTop: "20px",
              padding: "13px 20px",
              borderRadius: "10px",
              background: "#07513f",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Back to Companions
          </Link>
        </div>
      </main>
    );
  }

  const petName = clean(pet?.name) || petId;
  const petBreed = clean(pet?.breed);
  const petPrice = pet?.price;
  const petImage = clean(pet?.photo || pet?.image);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "60px 20px",
        background: "#f5f7f3",
      }}
    >
      <div
        style={{
          maxWidth: "1090px",
          margin: "0 auto",
        }}
      >
        <Link
          href={`/pets/${encodeURIComponent(petId)}`}
          style={{
            color: "#07513f",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          ← Back to {petName}
        </Link>

        <div
          style={{
            marginTop: "28px",
            background: "#fff",
            borderRadius: "28px",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(0, 1fr)",
            boxShadow: "0 15px 45px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              minHeight: "620px",
              background: "#eef2ed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "28px",
            }}
          >
            {petImage ? (
              <img
                src={petImage}
                alt={`${petName} – ${petBreed}`}
                style={{
                  width: "100%",
                  height: "560px",
                  objectFit: "cover",
                  borderRadius: "20px",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  color: "#527267",
                  fontWeight: 700,
                }}
              >
                PETORA
              </div>
            )}
          </div>

          <div
            style={{
              padding: "52px 46px",
            }}
          >
            <div
              style={{
                color: "#b88627",
                fontSize: "13px",
                fontWeight: 900,
                letterSpacing: "2px",
              }}
            >
              PETORA PURCHASE
            </div>

            <h1
              style={{
                margin: "20px 0 4px",
                color: "#07513f",
                fontSize: "52px",
                lineHeight: 1,
              }}
            >
              {petName}
            </h1>

            {petBreed && (
              <h2
                style={{
                  margin: "12px 0 30px",
                  color: "#07513f",
                  fontSize: "25px",
                }}
              >
                {petBreed}
              </h2>
            )}

            <div
              style={{
                background: "#f4f6f1",
                borderRadius: "18px",
                padding: "22px",
                marginBottom: "28px",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  color: "#527267",
                  marginBottom: "6px",
                }}
              >
                TOTAL PURCHASE PRICE
              </div>

              <div
                style={{
                  color: "#07513f",
                  fontSize: "30px",
                  fontWeight: 900,
                }}
              >
                {formatINR(petPrice)}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "#527267",
                  fontSize: "14px",
                }}
              >
                Full payment • No booking deposit
              </div>
            </div>

            {success ? (
              <div
                style={{
                  background: "#edf8f1",
                  border: "1px solid #b8ddc5",
                  borderRadius: "16px",
                  padding: "22px",
                }}
              >
                <h2
                  style={{
                    marginTop: 0,
                    color: "#07513f",
                  }}
                >
                  Payment Successful ✓
                </h2>

                <p
                  style={{
                    color: "#365d50",
                    lineHeight: 1.6,
                  }}
                >
                  Your payment has been verified successfully.
                  PETORA will use your purchase details to complete
                  the next steps for this companion.
                </p>

                <Link
                  href={`/pets/${encodeURIComponent(petId)}`}
                  style={{
                    display: "inline-block",
                    marginTop: "10px",
                    padding: "13px 18px",
                    borderRadius: "10px",
                    background: "#07513f",
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 800,
                  }}
                >
                  Back to {petName}
                </Link>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #d8e0da",
                      fontSize: "16px",
                      outline: "none",
                    }}
                  />

                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    type="tel"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #d8e0da",
                      fontSize: "16px",
                      outline: "none",
                    }}
                  />

                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    type="email"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #d8e0da",
                      fontSize: "16px",
                      outline: "none",
                    }}
                  />
                </div>

                {error && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "13px 15px",
                      borderRadius: "10px",
                      background: "#fff2f0",
                      color: "#a52b20",
                      fontSize: "14px",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={startPayment}
                  disabled={paying}
                  style={{
                    width: "100%",
                    marginTop: "18px",
                    padding: "17px 20px",
                    border: 0,
                    borderRadius: "12px",
                    background: "#07513f",
                    color: "#fff",
                    fontSize: "16px",
                    fontWeight: 900,
                    cursor: paying
                      ? "wait"
                      : "pointer",
                    opacity: paying ? 0.7 : 1,
                  }}
                >
                  {paying
                    ? "Opening Secure Payment..."
                    : `Pay ${formatINR(
                        petPrice
                      )} & Confirm Purchase →`}
                </button>

                <p
                  style={{
                    marginTop: "16px",
                    color: "#64756e",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  You will be redirected to Razorpay's secure
                  checkout to complete the full purchase payment.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
