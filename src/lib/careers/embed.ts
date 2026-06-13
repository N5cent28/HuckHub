import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

export async function embedText(text: string): Promise<Float32Array> {
  const trimmed = text.trim();
  if (!trimmed) {
    return new Float32Array(384);
  }
  const model = await getExtractor();
  const output = await model(trimmed, { pooling: "mean", normalize: true });
  return new Float32Array(output.data as Float32Array);
}

export async function embedCareerFields(fields: {
  career_field?: string | null;
  current_role?: string | null;
  education?: string | null;
  career_summary?: string | null;
}): Promise<Float32Array> {
  const parts: string[] = [];
  if (fields.career_field && fields.career_field !== "unknown") {
    parts.push(`Career field: ${fields.career_field}`);
  }
  if (fields.current_role && fields.current_role !== "unknown") {
    parts.push(`Role: ${fields.current_role}`);
  }
  if (fields.education && fields.education !== "unknown") {
    parts.push(`Education: ${fields.education}`);
  }
  if (fields.career_summary && fields.career_summary !== "unknown") {
    parts.push(`Summary: ${fields.career_summary}`);
  }
  return embedText(parts.join(". "));
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  return dot(a, b);
}

export { dot };
