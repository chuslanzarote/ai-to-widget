export interface ScaffoldOptions {
    targetDir: string;
    force: boolean;
    dryRun: boolean;
}
export interface ScaffoldResult {
    createdPaths: string[];
    gitignore: "created" | "appended" | "unchanged";
    preservedBuilderPaths: string[];
}
export declare function scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult>;
//# sourceMappingURL=scaffold.d.ts.map