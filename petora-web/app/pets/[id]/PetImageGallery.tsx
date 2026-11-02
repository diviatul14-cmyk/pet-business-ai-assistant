"use client";

import { useState } from "react";

type PetImageGalleryProps = {
  images: string[];
  alt: string;
};

export default function PetImageGallery({ images, alt }: PetImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(images[0] || "");

  if (images.length === 0 || !selectedImage) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 22,
          background: "#e9eee8",
          display: "grid",
          placeItems: "center",
          color: "#52665b",
          textAlign: "center",
          padding: 20,
        }}
      >
        No photo available
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0 }}>
      <img
        src={selectedImage}
        alt={alt}
        style={{
          display: "block",
          width: "100%",
          aspectRatio: "1 / 1",
          objectFit: "cover",
          borderRadius: 22,
          background: "#e9eee8",
        }}
      />

      {images.length > 1 && (
        <div
          aria-label="More photos"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setSelectedImage(src)}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={selectedImage === src}
              style={{
                padding: 0,
                border: selectedImage === src ? "3px solid #07513f" : "2px solid #dbe4dc",
                borderRadius: 12,
                overflow: "hidden",
                background: "#e9eee8",
                cursor: "pointer",
                aspectRatio: "1 / 1",
              }}
            >
              <img
                src={src}
                alt={`${alt}, photo ${index + 1}`}
                loading="lazy"
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
