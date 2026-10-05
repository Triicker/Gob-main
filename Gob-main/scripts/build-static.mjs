import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputDirectory = path.resolve(projectRoot, "dist");

if (
  path.dirname(outputDirectory) !== projectRoot ||
  path.basename(outputDirectory) !== "dist"
) {
  throw new Error("Diretório de saída inválido.");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const rootEntries = await readdir(projectRoot, { withFileTypes: true });
const htmlFiles = rootEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => entry.name);

const staticDirectories = ["css", "img", "js", "videos"];

for (const file of htmlFiles) {
  await cp(path.join(projectRoot, file), path.join(outputDirectory, file));
}

for (const directory of staticDirectories) {
  await cp(path.join(projectRoot, directory), path.join(outputDirectory, directory), {
    recursive: true
  });
}

console.log(
  `Static build concluído: ${htmlFiles.length} páginas e ${staticDirectories.length} diretórios copiados para dist.`
);
