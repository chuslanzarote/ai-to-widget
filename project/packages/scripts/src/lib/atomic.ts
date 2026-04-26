import { promises as fs } from "node:fs";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";

export interface AtomicWriteOptions {
  backupSuffix?: string;
  mode?: number;
}

/**
 * Atomically write `content` to `targetPath`. If the file already exists,
 * the previous contents are copied to `<targetPath><backupSuffix>` before
 * the write. On write failure, the caller's prior file is restored from
 * the backup.
 */
export async function writeArtifactAtomic(
  targetPath: string,
  content: string | Buffer,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const backupSuffix = options.backupSuffix ?? ".bak";
  const backupPath = `${targetPath}${backupSuffix}`;

  await ensureDir(path.dirname(targetPath));

  const preExisted = await exists(targetPath);
  if (preExisted) {
    await fs.copyFile(targetPath, backupPath);
  }

  try {
    await writeFileAtomic(targetPath, content, {
      encoding: typeof content === "string" ? "utf8" : undefined,
      mode: options.mode,
    });
  } catch (err) {
    if (preExisted) {
      try {
        await fs.copyFile(backupPath, targetPath);
      } catch {
        // Swallow restore failure; surface original error instead.
      }
    }
    throw err;
  }
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}
