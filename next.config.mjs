/** @type {import('next').NextConfig} */
const nextConfig = {
  // Product images are served from wherever the client's catalog points.
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};
export default nextConfig;
