import "server-only";

import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: ["*.token", "*.accessToken", "*.apiKey", "*.password", "*.secret", "token", "accessToken", "apiKey", "password", "secret"],
    censor: "[REDACTED]",
  },
});
