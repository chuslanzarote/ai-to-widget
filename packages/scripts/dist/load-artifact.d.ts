import type { ArtifactKind, LoadedArtifact } from "./lib/types.js";
export declare function loadArtifactFromFile<K extends ArtifactKind>(kind: K, sourcePath: string): Promise<LoadedArtifact>;
export declare function runLoadArtifact(argv: string[]): Promise<number>;
//# sourceMappingURL=load-artifact.d.ts.map