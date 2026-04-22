export interface ConflictCheck {
    conflicts: string[];
    targetExists: boolean;
}
export declare function detectConflicts(targetDir: string): Promise<ConflictCheck>;
export declare const BUILDER_PRESERVED_SUBPATHS: string[];
export declare function isBuilderPreserved(relPath: string): boolean;
//# sourceMappingURL=conflicts.d.ts.map