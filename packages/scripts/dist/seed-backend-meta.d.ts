export type SeedAction = "unchanged" | "created" | "rewritten";
export interface SeededFile {
    path: string;
    sha256: string;
    bytes: number;
    action: SeedAction;
    backup?: string;
}
export interface SeedBackendMetaOptions {
    projectRoot: string;
    backendPackageDir?: string;
    backup?: boolean;
}
export declare function defaultBackendPackageDir(): string;
export declare function seedBackendMeta(opts: SeedBackendMetaOptions): Promise<SeededFile[]>;
//# sourceMappingURL=seed-backend-meta.d.ts.map