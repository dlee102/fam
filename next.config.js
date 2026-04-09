/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["firebase-admin"],
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/favicon.svg", permanent: false },
    ];
  },
};

module.exports = nextConfig;
