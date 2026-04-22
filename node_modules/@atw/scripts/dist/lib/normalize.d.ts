/**
 * Normalize a buffer before hashing: convert CRLF line endings to LF so that
 * a Windows-edited file does not produce a different hash from a POSIX-edited
 * file with identical content.
 *
 * No other normalization is applied — over-normalizing (e.g., trimming
 * whitespace or stripping BOMs) would mask real Builder changes.
 */
export declare function normalizeForHash(buffer: Buffer): Buffer;
//# sourceMappingURL=normalize.d.ts.map