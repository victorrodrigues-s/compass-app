/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A LP roda embedada em outra página? Ajuste aqui os headers de frame.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
