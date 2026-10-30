const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
function load(file, stubs = {}) {
  const filename = path.resolve(file);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  const req = (name) =>
    Object.hasOwn(stubs, name)
      ? stubs[name]
      : name === "server-only"
        ? {}
        : name.startsWith(".")
          ? load(path.resolve(path.dirname(filename), name) + ".ts", stubs)
          : require(name);
  vm.runInNewContext(
    source,
    {
      exports,
      require: req,
      Date,
      structuredClone,
      Intl,
      URL,
      URLSearchParams,
      crypto: globalThis.crypto,
      Response,
      Request,
      Buffer,
      process,
      fetch: globalThis.fetch,
      AbortSignal,
      TextEncoder,
    },
    { filename },
  );
  return exports;
}
module.exports = { load };
