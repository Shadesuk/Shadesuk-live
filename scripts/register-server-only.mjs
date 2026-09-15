import Module from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const originalLoad = Module._load;
Module._load = function loadStub(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

register(new URL("./server-only-loader.mjs", import.meta.url).href, pathToFileURL("./"));
