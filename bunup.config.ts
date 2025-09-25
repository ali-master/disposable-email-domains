import { defineConfig } from "bunup";
import { shims, exports } from "bunup/plugins";

/**
 * @internal
 */
const config = defineConfig([
  {
    entry: ["src/syncer/index.ts"],
    format: ["esm"],
    outDir: "./dist/syncer",
    target: "bun",
    dts: true,
    plugins: [shims(), exports()],
    clean: true,
    minify: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
  },
  {
    entry: ["src/client/index.ts"],
    format: ["esm"],
    outDir: "./dist/client",
    target: "bun",
    dts: true,
    plugins: [shims(), exports()],
    clean: true,
    minify: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
  },
]);

export default config;
