import type { SentimentLabel } from '@/types';

export type RawSentimentPrediction = {
  label: SentimentLabel | null;
  status: 'predicted' | 'unknown_vocabulary' | 'empty_input';
  scores: number[] | null;
  scoreType: string;
  experimental: boolean;
};

export function createSentimentClassifier(
  model: unknown
): (text: string) => RawSentimentPrediction;
