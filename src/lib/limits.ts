// Upload size limits, shared between API routes and the upload UI. Kept out
// of route files because Next.js route modules may only export request
// handlers (and a small set of route config constants) — a plain constant
// export from a route file is invalid.
export const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
