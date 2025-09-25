import { defineConfig } from "bunup";
import { shims, exports } from "bunup/plugins";

/**
 * @internal
 */
const config = defineConfig([
  {
    entry: ["src/client/index.ts"],
    format: ["esm"],
    outDir: "./dist/client",
    target: "node",
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
