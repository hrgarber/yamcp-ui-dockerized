import path from "path";
import fs from "fs";

export function mkdirIfNotExists(dirPath: string) {
  // Create the directory if it doesn't exist
  const dir = path.dirname(dirPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
