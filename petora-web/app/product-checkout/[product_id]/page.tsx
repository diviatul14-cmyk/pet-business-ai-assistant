"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Product = {
  product_id?: string;
  category?: string;
  subcategory?: string;
  product_name?: string;
  brand?: string;
  price?: string | number;
  mrp?: string | number;
  stock?: string | number;
  unit?: string;
  image?: string;
  photo?: string;
  description?: string;
  status?: string;
};

type RoyalCaninVariant = {
  id: string;
  label: string;
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

const royalCaninVariants: RoyalCaninVariant[] = [
  { id: "PF001-800G", label: "800 g" },
  { id: "PF001-1.1KG", label: "1.1 kg" },
  { id: "PF001-4KG", label: "4 kg" },
  { id: "PF001-8KG", label: "8 kg" },
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function money(value: unknown): string {
  const number = Number(
    clean(value)
      .replace(/₹/g, "")
      .replace(/,/g, "")
      .replace(/\s/g, "")
  );

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return `₹${number.toLocaleString("en-IN")}`;
}

function numericMoney(value: unknown): number {
  const number = Number(
    clean(value)
      .replace(/₹/g, "")
      .replace(/,/g, "")
      .replace(/\s/g, "")
  );

  return Number.isFinite(number) ? number : 0;
}

function isRoyalCaninFamily(productId: string): boolean {
  const id = clean(productId).toUpperCase();

  return id === "PF001" || id.startsWith("PF001-");
}

function getDefaultRoyalCaninVariant(productId: string): string {
  const id = clean(productId).toUpperCase();

  if (id === "PF001") {
    return "PF001-800G";
  }

  if (royalCaninVariants.some((variant) => variant.id === id)) {
    return id;
  }

  return "PF001-800G";
}

function imageForProduct(productId: string, product: Product): string {
  const id = clean(productId).toUpperCase();

  /*
   * Royal Canin main product image.
   *
   * This file already exists in your project.
   */
  if (id.startsWith("PF001")) {
    return "/products/premium-puppy-food.png";
  }

  if (id === "PP001") {
    return "/products/pet-shampoo.png";
  }

  if (id === "PA001") {
    return "/products/premium-dog-collar.png";
  }

  const raw = clean(product.image || product.photo);

  if (!raw) {
    return "";
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  return raw.startsWith("/")
    ? raw
    : `/${raw.replace(/^\/+/, "")}`;
}

/*
 * Royal Canin gallery.
 *
 * The first image already exists.
 * Add the optional images later using these exact filenames:
 *
 * /public/products/royal-canin-mini-puppy-2.png
 * /public/products/royal-canin-mini-puppy-3.png
 * /public/products/royal-canin-mini-puppy-4.png
 * /public/products/royal-canin-mini-puppy-5.png
 *
 * Until those files are added, they simply disappear from the gallery.
 */
function getGalleryImages(
  productId: string,
  product: Product
): string[] {
  if (isRoyalCaninFamily(productId)) {
    return [
      imageForProduct(productId, product),
      "/products/royal-canin-mini-puppy-2.png",
      "/products/royal-canin-mini-puppy-3.png",
      "/products/royal-canin-mini-puppy-4.png",
      "/products/royal-canin-mini-puppy-5.png",
    ].filter(Boolean);
  }

  const mainImage = imageForProduct(productId, product);

  return mainImage ? [mainImage] : [];
}

async function readApiResponse(response: Response): Promise<any> {
  const text = await response.text();

  if (!text) {
    throw new Error(
      `Server returned an empty response (${response.status}).`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    if (
      text.includes("<!DOCTYPE") ||
      text.includes("<html")
    ) {
      throw new Error(
        `The server returned an HTML error page (${response.status}). Please check the API route.`
      );
    }

    throw new Error(text);
  }
}

export default function ProductCheckoutPage() {
  const params = useParams();
  const router = useRouter();

  const productId = clean(
    Array.isArray(params?.product_id)
      ? params.product_id[0]
      : params?.product_id
  );

  const [product, setProduct] = useState<Product | null>(null);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const [activeImage, setActiveImage] = useState(0);

  /*
   * ---------------------------------------------------------
   * Determine the actual product ID being purchased.
   *
   * PF001 is the main Royal Canin family.
   * PF001 automatically starts with the 800 g variant.
   * ---------------------------------------------------------
   */
  const targetProductId = isRoyalCaninFamily(productId)
    ? selectedProductId ||
      getDefaultRoyalCaninVariant(productId)
    : productId;

  /*
   * ---------------------------------------------------------
   * Load Razorpay
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (document.getElementById("razorpay-checkout-js")) {
      return;
    }

    const script = document.createElement("script");

    script.id = "razorpay-checkout-js";
    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    document.body.appendChild(script);
  }, []);

  /*
   * ---------------------------------------------------------
   * Load product from Google Sheets
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!productId) {
      setPageError("Invalid product ID.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProduct() {
      try {
        setLoading(true);
        setPageError("");

        const response = await fetch("/api/products", {
          cache: "no-store",
        });

        const data = await readApiResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.message ||
              `Unable to load products (${response.status}).`
          );
        }

        const products: Product[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
            ? data.products
            : Array.isArray(data?.data)
              ? data.data
              : [];

        const found = products.find(
          (item) =>
            clean(item.product_id).toUpperCase() ===
            targetProductId.toUpperCase()
        );

        if (!found) {
          throw new Error(
            `Product ${targetProductId} was not found in the Products sheet.`
          );
        }

        if (!cancelled) {
          setProduct(found);
          setActiveImage(0);

          /*
           * If the user opened /product-checkout/PF001,
           * select the default 800 g variant.
           */
          if (
            isRoyalCaninFamily(productId) &&
            !selectedProductId
          ) {
            setSelectedProductId(targetProductId);
          }
        }
      } catch (error) {
        console.error(
          "PETORA product load error:",
          error
        );

        if (!cancelled) {
          setProduct(null);

          setPageError(
            error instanceof Error
              ? error.message
              : "Unable to load this product."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [
    productId,
    targetProductId,
    selectedProductId,
  ]);

  /*
   * ---------------------------------------------------------
   * Gallery
   * ---------------------------------------------------------
   */
  const galleryImages = useMemo(() => {
    if (!product) {
      return [];
    }

    return getGalleryImages(
      targetProductId,
      product
    );
  }, [product, targetProductId]);

  const safeActiveImage =
    activeImage < galleryImages.length
      ? activeImage
      : 0;

  const imageSrc =
    galleryImages[safeActiveImage] || "";

  /*
   * ---------------------------------------------------------
   * Price
   * ---------------------------------------------------------
   */
  const priceNumber = numericMoney(product?.price);
  const mrpNumber = numericMoney(product?.mrp);

  const priceText = money(product?.price);
  const mrpText = money(product?.mrp);

  const hasDiscount =
    mrpNumber > priceNumber && priceNumber > 0;

  const discountPercent = hasDiscount
    ? Math.round(
        ((mrpNumber - priceNumber) / mrpNumber) * 100
      )
    : 0;

  /*
   * ---------------------------------------------------------
   * Select Royal Canin variant
   * ---------------------------------------------------------
   */
  function selectVariant(variantId: string) {
    setPaymentError("");
    setSuccess(false);
    setPaymentId("");

    setSelectedProductId(variantId);
    setActiveImage(0);
  }

  /*
   * ---------------------------------------------------------
   * Payment
   * ---------------------------------------------------------
   */
  async function payNow(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!product) {
      setPaymentError(
        "Product information is unavailable."
      );
      return;
    }

    const customerName = name.trim();
    const customerPhone = phone.trim();
    const customerEmail = email.trim();
    const customerAddress = address.trim();

    if (!customerName) {
      setPaymentError(
        "Please enter your full name."
      );
      return;
    }

    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
      setPaymentError(
        "Please enter a valid 10-digit Indian mobile number."
      );
      return;
    }

    if (
      !customerEmail ||
      !customerEmail.includes("@")
    ) {
      setPaymentError(
        "Please enter a valid email address."
      );
      return;
    }

    if (!customerAddress) {
      setPaymentError(
        "Please enter your delivery address."
      );
      return;
    }

    /*
     * IMPORTANT:
     *
     * For Royal Canin, use the selected variant ID.
     *
     * Example:
     * PF001-800G
     * PF001-1.1KG
     * PF001-4KG
     * PF001-8KG
     */
    const purchaseProductId =
      isRoyalCaninFamily(productId)
        ? selectedProductId ||
          getDefaultRoyalCaninVariant(productId)
        : productId;

    setPaying(true);
    setPaymentError("");

    try {
      /*
       * =====================================================
       * STEP 1
       * Create Razorpay order
       *
       * Only the PRODUCT ID is sent.
       *
       * The server reads the real price from Google Sheets.
       * =====================================================
       */

      const createResponse = await fetch(
        "/api/product-payment/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: purchaseProductId,
          }),
        }
      );

      const orderData =
        await readApiResponse(createResponse);

      if (
        !createResponse.ok ||
        !orderData?.success
      ) {
        throw new Error(
          orderData?.error ||
            orderData?.message ||
            "Unable to create payment order."
        );
      }

      const orderId = clean(
        orderData.order_id
      );

      const keyId = clean(
        orderData.key_id
      );

      const amount = Number(
        orderData.amount
      );

      if (!orderId) {
        throw new Error(
          "Razorpay order ID was not returned."
        );
      }

      if (!keyId) {
        throw new Error(
          "Razorpay Key ID was not returned."
        );
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "Invalid payment amount returned by the server."
        );
      }

      /*
       * Wait for Razorpay Checkout.
       */
      if (!window.Razorpay) {
        await new Promise<void>(
          (resolve, reject) => {
            const started = Date.now();

            const timer =
              window.setInterval(() => {
                if (window.Razorpay) {
                  window.clearInterval(timer);
                  resolve();
                  return;
                }

                if (
                  Date.now() - started >
                  10000
                ) {
                  window.clearInterval(timer);

                  reject(
                    new Error(
                      "Razorpay Checkout could not be loaded. Please refresh the page."
                    )
                  );
                }
              }, 200);
          }
        );
      }

      /*
       * =====================================================
       * STEP 2
       * Open Razorpay
       * =====================================================
       */

      const checkout =
        new window.Razorpay({
          key: keyId,
          amount,
          currency:
            clean(orderData.currency) ||
            "INR",

          name: "PETORA™",

          description: `${
            product.product_name ||
            "PETORA Product"
          } - Full Payment`,

          order_id: orderId,

          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },

          notes: {
            product_id:
              purchaseProductId,

            customer_name:
              customerName,

            phone:
              customerPhone,

            email:
              customerEmail,

            address:
              customerAddress,

            purchase_type:
              "PETORA_PRODUCT_FULL_PAYMENT",
          },

          theme: {
            color: "#087c68",
          },

          /*
           * =================================================
           * STEP 3
           * Verify payment on the server
           * =================================================
           */
          handler: async function (
            response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }
          ) {
            try {
              setPaymentError("");

              const verifyResponse =
                await fetch(
                  "/api/product-payment/verify",
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body: JSON.stringify({
                      product_id:
                        purchaseProductId,

                      customer_name:
                        customerName,

                      phone:
                        customerPhone,

                      email:
                        customerEmail,

                      address:
                        customerAddress,

                      razorpay_payment_id:
                        response.razorpay_payment_id,

                      razorpay_order_id:
                        response.razorpay_order_id,

                      razorpay_signature:
                        response.razorpay_signature,
                    }),
                  }
                );

              const verifyData =
                await readApiResponse(
                  verifyResponse
                );

              if (
                !verifyResponse.ok ||
                !verifyData?.success
              ) {
                throw new Error(
                  verifyData?.error ||
                    verifyData?.message ||
                    "Payment verification failed."
                );
              }

              setPaymentId(
                response.razorpay_payment_id
              );

              setSuccess(true);
            } catch (error) {
              console.error(
                "PETORA payment verification error:",
                error
              );

              setPaymentError(
                error instanceof Error
                  ? error.message
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
        });

      checkout.on(
        "payment.failed",
        function (response: any) {
          console.error(
            "Razorpay payment failed:",
            response
          );

          setPaymentError(
            response?.error
              ?.description ||
              "Payment failed. Please try again."
          );

          setPaying(false);
        }
      );

      checkout.open();
    } catch (error) {
      console.error(
        "PETORA checkout error:",
        error
      );

      setPaymentError(
        error instanceof Error
          ? error.message
          : "Unable to start payment."
      );

      setPaying(false);
    }
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <main className="page">
        <div className="message-card">
          <div className="logo">
            PETORA™
          </div>

          <p>
            Loading product...
          </p>
        </div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6f0e5;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
            font-family: Arial, sans-serif;
          }

          .message-card {
            background: white;
            padding: 45px;
            border-radius: 24px;
            text-align: center;
            box-shadow:
              0 20px 60px rgba(0, 0, 0, 0.08);
          }

          .logo {
            color: #087c68;
            font-size: 30px;
            font-weight: 900;
          }

          p {
            color: #687671;
          }
        `}</style>
      </main>
    );
  }

  /*
   * =========================================================
   * ERROR
   * =========================================================
   */

  if (pageError || !product) {
    return (
      <main className="page">
        <div className="message-card">
          <div className="logo">
            PETORA™
          </div>

          <h1>
            Product unavailable
          </h1>

          <p>
            {pageError ||
              "This product could not be found."}
          </p>

          <button
            onClick={() =>
              router.push("/")
            }
          >
            Back to PETORA
          </button>
        </div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6f0e5;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
            font-family: Arial, sans-serif;
          }

          .message-card {
            width: min(520px, 100%);
            background: white;
            padding: 45px;
            border-radius: 24px;
            text-align: center;
            box-shadow:
              0 20px 60px rgba(0, 0, 0, 0.08);
          }

          .logo {
            color: #087c68;
            font-size: 30px;
            font-weight: 900;
            margin-bottom: 20px;
          }

          h1 {
            color: #075f50;
            font-family: Georgia, serif;
          }

          p {
            color: #687671;
            line-height: 1.6;
          }

          button {
            margin-top: 15px;
            border: 0;
            background: #087c68;
            color: white;
            padding: 14px 24px;
            border-radius: 12px;
            font-weight: 800;
            cursor: pointer;
          }
        `}</style>
      </main>
    );
  }

  /*
   * =========================================================
   * SUCCESS
   * =========================================================
   */

  if (success) {
    return (
      <main className="page">
        <div className="success-card">
          <div className="success-icon">
            ✓
          </div>

          <div className="eyebrow">
            PETORA™ STORE
          </div>

          <h1>
            Payment Successful
          </h1>

          <p>
            Your full payment for{" "}
            <strong>
              {product.product_name}
            </strong>{" "}
            has been successfully verified.
          </p>

          <div className="details">
            <div>
              <span>
                Product
              </span>

              <strong>
                {product.product_name}
              </strong>
            </div>

            <div>
              <span>
                Pack
              </span>

              <strong>
                {product.unit}
              </strong>
            </div>

            <div>
              <span>
                Amount Paid
              </span>

              <strong>
                {priceText}
              </strong>
            </div>

            {paymentId && (
              <div>
                <span>
                  Payment ID
                </span>

                <strong>
                  {paymentId}
                </strong>
              </div>
            )}
          </div>

          <button
            onClick={() =>
              router.push("/")
            }
          >
            Return to PETORA
          </button>
        </div>

        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #f6f0e5;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px;
            font-family: Arial, sans-serif;
          }

          .success-card {
            width: min(620px, 100%);
            background: white;
            padding: 50px;
            border-radius: 28px;
            text-align: center;
            box-shadow:
              0 25px 70px rgba(0, 0, 0, 0.1);
          }

          .success-icon {
            width: 72px;
            height: 72px;
            margin: 0 auto 20px;
            border-radius: 50%;
            background: #087c68;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 42px;
            font-weight: 900;
          }

          .eyebrow {
            color: #b78327;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 3px;
          }

          h1 {
            color: #075f50;
            font-family: Georgia, serif;
            font-size: 44px;
            margin: 15px 0;
          }

          p {
            color: #687671;
            line-height: 1.6;
            font-size: 17px;
          }

          .details {
            margin: 30px 0;
            padding: 20px;
            border-radius: 16px;
            background: #edf7f3;
          }

          .details div {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 10px 0;
            text-align: left;
          }

          .details span {
            color: #687671;
          }

          .details strong {
            color: #075f50;
            text-align: right;
          }

          button {
            border: 0;
            background: #087c68;
            color: white;
            padding: 15px 26px;
            border-radius: 12px;
            font-weight: 800;
            cursor: pointer;
          }
        `}</style>
      </main>
    );
  }

  /*
   * =========================================================
   * CHECKOUT
   * =========================================================
   */

  return (
    <main className="page">
      <div className="shell">

        <button
          className="back"
          type="button"
          onClick={() =>
            router.push("/")
          }
        >
          ← Back to PETORA
        </button>

        <div className="grid">

          {/* =================================================
              PRODUCT SECTION
              ================================================= */}

          <section className="product-card">

            <div className="gallery">

              {/* MAIN IMAGE */}

              <div className="image-box">

                {imageSrc ? (
                  <img
                    key={imageSrc}
                    src={imageSrc}
                    alt={
                      product.product_name ||
                      "PETORA Product"
                    }
                    onError={(event) => {
                      /*
                       * If an optional gallery image
                       * has not been added yet, hide it.
                       */
                      if (
                        safeActiveImage !== 0
                      ) {
                        event.currentTarget.style.display =
                          "none";
                      }
                    }}
                  />
                ) : (
                  <div className="placeholder">
                    PETORA™
                  </div>
                )}

              </div>

              {/* THUMBNAILS */}

              {galleryImages.length > 1 && (
                <div className="thumbnail-row">

                  {galleryImages.map(
                    (image, index) => (
                      <button
                        key={image}
                        type="button"
                        className={
                          index ===
                          safeActiveImage
                            ? "thumbnail active"
                            : "thumbnail"
                        }
                        onClick={() => {
                          setActiveImage(index);
                        }}
                      >
                        <img
                          src={image}
                          alt={`Product view ${
                            index + 1
                          }`}
                          onError={(
                            event
                          ) => {
                            event.currentTarget.style.display =
                              "none";
                          }}
                        />
                      </button>
                    )
                  )}

                </div>
              )}

            </div>

            <div className="product-info">

              <div className="eyebrow">
                {clean(
                  product.subcategory
                ) ||
                  clean(
                    product.category
                  ) ||
                  "PET PRODUCTS"}
              </div>

              <h1>
                {product.product_name}
              </h1>

              <p className="brand">
                by{" "}
                {product.brand ||
                  "PETORA"}
              </p>

              <p className="description">
                {product.description ||
                  "Quality product for your pet."}
              </p>

              {/* ROYAL CANIN VARIANTS */}

              {isRoyalCaninFamily(
                productId
              ) && (
                <div className="variant-section">

                  <div className="variant-title">
                    Choose pack size
                  </div>

                  <div className="variant-grid">

                    {royalCaninVariants.map(
                      (variant) => {
                        const selected =
                          targetProductId.toUpperCase() ===
                          variant.id.toUpperCase();

                        return (
                          <button
                            key={variant.id}
                            type="button"
                            className={
                              selected
                                ? "variant-button selected"
                                : "variant-button"
                            }
                            onClick={() =>
                              selectVariant(
                                variant.id
                              )
                            }
                          >
                            {variant.label}
                          </button>
                        );
                      }
                    )}

                  </div>

                </div>
              )}

              {/* PRICE */}

              <div className="price-row">

                <div className="price">
                  {priceText}
                </div>

                {hasDiscount && (
                  <>
                    <del>
                      {mrpText}
                    </del>

                    <span className="discount">
                      {discountPercent}% OFF
                    </span>
                  </>
                )}

              </div>

              {product.unit && (
                <p className="unit">
                  Unit:{" "}
                  {product.unit}
                </p>
              )}

              <div className="full-payment">

                <strong>
                  Full payment
                </strong>

                <span>
                  No booking deposit •
                  No partial payment
                </span>

              </div>

            </div>
          </section>

          {/* =================================================
              CHECKOUT SECTION
              ================================================= */}

          <section className="checkout-card">

            <div className="eyebrow">
              SECURE CHECKOUT
            </div>

            <h2>
              Complete your
              <br />
              purchase.
            </h2>

            <p className="intro">
              Enter your details below.
              The payment amount is
              taken from the current
              PETORA Products inventory.
            </p>

            {isRoyalCaninFamily(
              productId
            ) && (
              <div className="selected-pack">
                <span>
                  Selected pack
                </span>

                <strong>
                  {product.unit}
                </strong>
              </div>
            )}

            <div className="total">

              <span>
                Total purchase price
              </span>

              <strong>
                {priceText}
              </strong>

            </div>

            <form onSubmit={payNow}>

              <label>
                Full name

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>

              <label>
                Phone number

                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10)
                    )
                  }
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </label>

              <label>
                Email address

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <label>
                Delivery address

                <textarea
                  value={address}
                  onChange={(event) =>
                    setAddress(
                      event.target.value
                    )
                  }
                  placeholder="Enter your complete delivery address"
                  rows={4}
                  autoComplete="street-address"
                />
              </label>

              {paymentError && (
                <div className="error">
                  {paymentError}
                </div>
              )}

              <button
                className="pay"
                type="submit"
                disabled={paying}
              >
                {paying
                  ? "Opening secure payment..."
                  : `Pay ${priceText} & Confirm Purchase →`}
              </button>

              <div className="secure">
                Secure payment powered by Razorpay
              </div>

            </form>

          </section>

        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f6f0e5;
          color: #30443f;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          padding: 40px 20px 70px;
          box-sizing: border-box;
        }

        .shell {
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .back {
          border: 0;
          background: transparent;
          color: #087c68;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          margin-bottom: 24px;
          padding: 0;
        }

        .grid {
          display: grid;
          grid-template-columns:
            1.05fr
            0.95fr;
          gap: 28px;
          align-items: start;
        }

        .product-card,
        .checkout-card {
          background: white;
          border-radius: 28px;
          overflow: hidden;
          box-shadow:
            0 20px 60px
              rgba(0, 0, 0, 0.07);
        }

        /* =========================
           GALLERY
           ========================= */

        .gallery {
          background: #edf7f3;
          padding: 18px;
        }

        .image-box {
          height: 430px;
          background: #edf7f3;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 18px;
        }

        .image-box img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .placeholder {
          color: #087c68;
          font-size: 46px;
          font-weight: 900;
        }

        .thumbnail-row {
          display: grid;
          grid-template-columns:
            repeat(5, 1fr);
          gap: 10px;
          margin-top: 12px;
        }

        .thumbnail {
          height: 72px;
          padding: 5px;
          border: 2px solid
            transparent;
          background: white;
          border-radius: 12px;
          cursor: pointer;
          overflow: hidden;
        }

        .thumbnail.active {
          border-color: #087c68;
          box-shadow:
            0 5px 18px
              rgba(8, 124, 104, 0.16);
        }

        .thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
          display: block;
        }

        /* =========================
           PRODUCT INFORMATION
           ========================= */

        .product-info {
          padding: 34px;
        }

        .eyebrow {
          color: #b78327;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2.5px;
          text-transform: uppercase;
        }

        .product-info h1 {
          color: #075f50;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size:
            clamp(
              42px,
              5vw,
              66px
            );
          line-height: 0.95;
          letter-spacing: -2px;
          margin: 12px 0;
        }

        .brand {
          color: #6c7975;
          font-size: 18px;
          margin-bottom: 25px;
        }

        .description {
          color: #5e6e69;
          line-height: 1.6;
          font-size: 16px;
        }

        /* =========================
           VARIANTS
           ========================= */

        .variant-section {
          margin-top: 28px;
        }

        .variant-title {
          color: #17685b;
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 10px;
        }

        .variant-grid {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 10px;
        }

        .variant-button {
          border: 1px solid
            #d7e5df;
          background: white;
          color: #17685b;
          border-radius: 12px;
          padding: 13px 8px;
          font-weight: 900;
          cursor: pointer;
          transition:
            0.2s ease;
        }

        .variant-button:hover {
          border-color: #087c68;
        }

        .variant-button.selected {
          background: #087c68;
          border-color: #087c68;
          color: white;
          box-shadow:
            0 8px 20px
              rgba(8, 124, 104, 0.18);
        }

        /* =========================
           PRICE
           ========================= */

        .price-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 25px;
        }

        .price {
          color: #087c68;
          font-size: 34px;
          font-weight: 900;
        }

        .price-row del {
          color: #8c9692;
          font-size: 17px;
        }

        .discount {
          background: #fff3d9;
          color: #b78327;
          border: 1px solid
            #efd69c;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 13px;
          font-weight: 900;
        }

        .unit {
          color: #60716d;
          margin-top: 14px;
          font-size: 14px;
        }

        .full-payment {
          background: #edf7f3;
          padding: 15px;
          border-radius: 14px;
          margin-top: 22px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: #60716d;
          font-size: 13px;
        }

        .full-payment strong {
          color: #087c68;
        }

        /* =========================
           CHECKOUT
           ========================= */

        .checkout-card {
          padding: 38px;
        }

        .checkout-card h2 {
          color: #075f50;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size:
            clamp(
              46px,
              5vw,
              62px
            );
          line-height: 0.94;
          letter-spacing: -2px;
          margin: 14px 0 20px;
        }

        .intro {
          color: #687671;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .selected-pack {
          background: #f3faf7;
          border: 1px solid
            #d7e9e2;
          border-radius: 14px;
          padding: 15px 17px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 12px;
        }

        .selected-pack span {
          color: #687671;
          font-size: 14px;
          font-weight: 800;
        }

        .selected-pack strong {
          color: #087c68;
          font-size: 15px;
        }

        .total {
          background: #087c68;
          color: white;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 25px;
        }

        .total span {
          font-size: 14px;
          font-weight: 800;
        }

        .total strong {
          font-size: 27px;
          white-space: nowrap;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        label {
          color: #17685b;
          font-size: 14px;
          font-weight: 800;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid
            #d7e5df;
          border-radius: 12px;
          padding: 14px;
          color: #243c36;
          background: white;
          font-size: 16px;
          font-family: inherit;
          outline: none;
        }

        input:focus,
        textarea:focus {
          border-color: #087c68;
          box-shadow:
            0 0 0 3px
              rgba(
                8,
                124,
                104,
                0.1
              );
        }

        textarea {
          resize: vertical;
        }

        .error {
          background: #fff1f0;
          border: 1px solid
            #efc9c5;
          color: #a23a32;
          border-radius: 12px;
          padding: 13px;
          font-size: 14px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .pay {
          border: 0;
          border-radius: 13px;
          padding: 17px;
          background: #087c68;
          color: white;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .pay:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .secure {
          text-align: center;
          color: #7a8783;
          font-size: 12px;
          margin-top: 4px;
        }

        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .variant-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .thumbnail-row {
            grid-template-columns:
              repeat(5, 1fr);
          }

          .thumbnail {
            height: 58px;
          }
        }

        @media (max-width: 520px) {
          .page {
            padding:
              25px
              14px
              50px;
          }

          .gallery {
            padding: 10px;
          }

          .image-box {
            height: 320px;
          }

          .product-info,
          .checkout-card {
            padding:
              25px
              20px;
          }

          .product-info h1 {
            font-size: 42px;
          }

          .checkout-card h2 {
            font-size: 46px;
          }

          .thumbnail {
            height: 52px;
          }

          .price {
            font-size: 30px;
          }
        }
      `}</style>
    </main>
  );
}