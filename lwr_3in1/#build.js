const ESBuild = require("esbuild");

ESBuild.build({
    entryPoints: ["lwr_3in1/index.mjs"],
    outfile: "lwr_3in1/index.min.js",
    bundle: true,
    minify: true,
    target: "es6",
    external: [],
    sourcemap: "external"
});
