import React from "react";

/**
 * NeuralField — the living backdrop of the app.
 * Slowly morphing aurora blobs ("neural liquid") drifting through deep
 * obsidian space, sealed with film grain and a soft vignette. Pure CSS
 * animation, GPU-friendly transforms only.
 */
export default function NeuralField() {
  return (
    <div className="neural-field" aria-hidden="true">
      <div className="neural-blob neural-blob-a" />
      <div className="neural-blob neural-blob-b" />
      <div className="neural-blob neural-blob-c" />
      <div className="neural-blob neural-blob-d" />
      <div className="neural-grain" />
      <div className="neural-vignette" />
    </div>
  );
}
