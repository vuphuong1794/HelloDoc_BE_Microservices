export interface ClassificationResult {
    text: string;
    tokens: string[];
    pos_tags: Array<[string, string]>;
    success: boolean;
    error?: string;
}