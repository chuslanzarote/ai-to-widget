import type { Root, Heading, ListItem } from "mdast";
import type { ArtifactKind, ArtifactContent } from "./types.js";
export interface ParsedMarkdown {
    frontmatter: Record<string, unknown>;
    tree: Root;
    rawBody: string;
}
export declare function readMarkdown(path: string): Promise<ParsedMarkdown>;
export declare function parseMarkdown(raw: string): ParsedMarkdown;
export declare function serializeMarkdown(frontmatter: Record<string, unknown>, body: string): string;
export interface Section {
    heading: string;
    level: number;
    children: Root["children"];
}
export declare function extractSections(tree: Root, level?: number): Section[];
export declare function headingText(h: Heading): string;
export declare function sectionText(section: Section): string;
export declare function findSection(sections: Section[], heading: string): Section | undefined;
export declare function extractCodeBlock(section: Section, lang: string): string | null;
export declare function extractListItems(section: Section): string[];
export declare function listItemText(li: ListItem): string;
export declare function parseArtifactFromMarkdown<K extends ArtifactKind>(kind: K, parsed: ParsedMarkdown): ArtifactContent<K>;
export declare function serializeArtifact<K extends ArtifactKind>(kind: K, content: ArtifactContent<K>): string;
//# sourceMappingURL=markdown.d.ts.map