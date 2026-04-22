import { type InputHashKind, type InputHashesState } from "./lib/types.js";
export interface HashResult {
    path: string;
    sha256: string;
    previousSha256: string | null;
    changed: boolean;
    kind: InputHashKind;
}
export declare function hashFile(filePath: string): Promise<string>;
export declare function loadState(statePath: string): Promise<InputHashesState | null>;
export declare function computeHashResults(opts: {
    rootDir: string;
    inputs: string[];
    previous: InputHashesState | null;
}): Promise<HashResult[]>;
export declare function writeState(statePath: string, results: HashResult[], now?: Date): Promise<void>;
export declare function runHashInputs(argv: string[]): Promise<number>;
//# sourceMappingURL=hash-inputs.d.ts.map