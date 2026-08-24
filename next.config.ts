import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Matches the trip-attachments storage bucket's 10 MB file_size_limit,
      // plus headroom for multipart/form-data boundary and field overhead.
      bodySizeLimit: "10.5mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    // Wraps the cron job declared in vercel.json with Sentry Cron Monitoring
    // (issue #25: monitor cron executions and reminder delivery failures).
    automaticVercelMonitors: true,
  },
});
