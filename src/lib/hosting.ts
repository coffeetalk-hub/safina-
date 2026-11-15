/**
 * Hosting switches, read at build time. NEXT_PUBLIC_ values are inlined by `next build` into server
 * and browser code, so they also reach Netlify functions, which never see netlify.toml variables
 * at runtime. netlify.toml sets NEXT_PUBLIC_SERVERLESS=true for every Netlify build.
 */
export const SERVERLESS_BUILD = process.env.NEXT_PUBLIC_SERVERLESS === "true";

/** Largest attachment. Netlify accepts about 4.5 MB of file per request, so serverless builds default to 4 MB. */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || (SERVERLESS_BUILD ? 4 : 15);
export const MAX_UPLOAD_BYTES = Math.round(MAX_UPLOAD_MB * 1024 * 1024);
