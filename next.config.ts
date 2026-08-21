import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Matches the trip-attachments storage bucket's 10 MB file_size_limit,
      // plus headroom for multipart/form-data boundary and field overhead.
      bodySizeLimit: "10.5mb",
    },
  },
};

export default nextConfig;
