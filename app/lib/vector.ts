export const VECTOR_SIZE = 256;
export const QDRANT_COLLECTION = "blog_posts";

function tokenize(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (const character of token) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embedText(value: string) {
  const vector = Array<number>(VECTOR_SIZE).fill(0);
  for (const token of tokenize(value)) {
    const hash = hashToken(token);
    const index = hash % VECTOR_SIZE;
    vector[index] += hash & 1 ? 1 : -1;
  }

  const magnitude = Math.sqrt(
    vector.reduce((total, component) => total + component * component, 0),
  );
  if (magnitude === 0) return vector;
  return vector.map((component) => component / magnitude);
}

