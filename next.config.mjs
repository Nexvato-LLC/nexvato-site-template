/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true }, // source uses <img> + many apostrophes; don't let lint block build
};
export default nextConfig;
