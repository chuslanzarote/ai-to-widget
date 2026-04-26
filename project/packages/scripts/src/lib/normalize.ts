/**
 * Normalize a buffer before hashing: convert CRLF line endings to LF so that
 * a Windows-edited file does not produce a different hash from a POSIX-edited
 * file with identical content.
 *
 * No other normalization is applied — over-normalizing (e.g., trimming
 * whitespace or stripping BOMs) would mask real Builder changes.
 */
export function normalizeForHash(buffer: Buffer): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte === 0x0d && buffer[i + 1] === 0x0a) {
      continue;
    }
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}
