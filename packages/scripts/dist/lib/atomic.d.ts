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
export declare function writeArtifactAtomic(targetPath: string, content: string | Buffer, options?: AtomicWriteOptions): Promise<void>;
export declare function exists(p: string): Promise<boolean>;
export declare function ensureDir(dir: string): Promise<void>;
//# sourceMappingURL=atomic.d.ts.map