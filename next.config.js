/** @type {import('next').NextConfig} */
const nextConfig = {
  // ให้ /index.html ใน public/ เป็นหน้าหลัก
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },
    ];
  },
};

module.exports = nextConfig;
