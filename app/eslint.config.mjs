import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // public/cesium is copied verbatim from the cesium package by
  // scripts/copy-cesium-assets.mjs and is never edited here.
  globalIgnores([".next/**", "coverage/**", "next-env.d.ts", "public/cesium/**"]),
]);

