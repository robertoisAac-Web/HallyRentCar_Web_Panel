import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "12mb" } }, // subida de fotos y comprobantes
};
export default config;
