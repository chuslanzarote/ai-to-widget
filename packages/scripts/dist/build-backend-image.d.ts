export interface BuildImageResult {
    image_id: string;
    ref: string;
    size_bytes: number;
}
export interface BuildImageOptions {
    contextDir: string;
    dockerfile?: string;
    tag?: string;
    labels?: Record<string, string>;
}
/**
 * Build the backend image via dockerode. Pre-flight guard: if the build
 * context contains a file named `.env` or `*.pem` we refuse to proceed to
 * avoid shipping secrets into the runtime image (FR-077 guard).
 */
export declare function buildBackendImage(opts: BuildImageOptions): Promise<BuildImageResult>;
export declare function runBuildBackendImage(argv: string[]): Promise<number>;
//# sourceMappingURL=build-backend-image.d.ts.map