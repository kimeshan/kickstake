import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KickStake",
    short_name: "KickStake",
    description:
      "Create a football tournament sweepstake, share a link, and let KickStake run the draw and the prizes for you.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e0a",
    theme_color: "#0a0e0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
