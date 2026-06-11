/**
 * The search engine — inverted index with TF-IDF ranking and trigram
 * fuzzy matching, so typos still find what you meant.
 */

export interface SearchDoc {
  id: string;
  text: string;
}

export interface SearchHit {
  id: string;
  score: number;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

function trigrams(word: string): Set<string> {
  const padded = `  ${word} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

function trigramSim(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

export class SearchIndex {
  private postings = new Map<string, Map<string, number>>(); // token -> doc -> tf
  private docCount = 0;
  private tokenGrams = new Map<string, Set<string>>();

  constructor(docs: SearchDoc[]) {
    this.docCount = docs.length;
    for (const doc of docs) {
      for (const token of tokenize(doc.text)) {
        let docs = this.postings.get(token);
        if (!docs) {
          docs = new Map();
          this.postings.set(token, docs);
          this.tokenGrams.set(token, trigrams(token));
        }
        docs.set(doc.id, (docs.get(doc.id) ?? 0) + 1);
      }
    }
  }

  /** Tokens matching a query word exactly, by prefix, or fuzzily by trigrams. */
  private expand(word: string): { token: string; weight: number }[] {
    const out: { token: string; weight: number }[] = [];
    const grams = trigrams(word);
    for (const [token, tGrams] of this.tokenGrams) {
      if (token === word) out.push({ token, weight: 1 });
      else if (token.startsWith(word)) out.push({ token, weight: 0.75 });
      else {
        const sim = trigramSim(grams, tGrams);
        if (sim >= 0.35) out.push({ token, weight: sim * 0.8 });
      }
    }
    return out;
  }

  search(query: string, limit = 20): SearchHit[] {
    const words = tokenize(query);
    if (words.length === 0) return [];
    const scores = new Map<string, number>();
    for (const word of words) {
      for (const { token, weight } of this.expand(word)) {
        const docs = this.postings.get(token)!;
        const idf = Math.log(1 + this.docCount / docs.size);
        for (const [docId, tf] of docs) {
          scores.set(docId, (scores.get(docId) ?? 0) + weight * idf * (1 + Math.log(tf)));
        }
      }
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
