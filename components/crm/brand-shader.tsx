"use client";

import { Shader, Swirl } from "shaders/react";

export default function BrandShader({
  unavailable,
}: {
  unavailable: () => void;
}) {
  return (
    <Shader
      disableTelemetry
      onUnavailable={unavailable}
      style={{ width: "100%", height: "100%" }}
    >
      <Swirl colorA="#251753" colorB="#9b73ff" speed={0.18} detail={0.6} />
    </Shader>
  );
}
