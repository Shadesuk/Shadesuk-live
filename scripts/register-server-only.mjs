import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./server-only-loader.mjs", import.meta.url).href, pathToFileURL("./"));
