import model from '../lib/ai/model-edom.json';
import { createSentimentClassifier } from '../lib/ai/sentiment';
import type { AiResult, SentimentLabel } from '../types';

const MODEL_NAME = 'model-edom';
const VALID_LABELS = new Set<SentimentLabel>(['positif', 'netral', 'negatif']);

const FAILED_RESULT: AiResult = {
  status: 'gagal',
  label: null,
  model: MODEL_NAME,
  experimental: true,
};

let classifier: ReturnType<typeof createSentimentClassifier> | null = null;
try {
  classifier = createSentimentClassifier(model);
} catch {
  classifier = null;
}

/**
 * Klasifikasi sentimen alasan izin secara lokal di perangkat (model-edom).
 * Info pendukung saja — tidak pernah melempar error dan tidak mengubah label null menjadi 'netral'.
 */
export function classifyReason(reason: string): AiResult {
  if (typeof reason !== 'string') {
    return { ...FAILED_RESULT };
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    return {
      status: 'empty_input',
      label: null,
      model: MODEL_NAME,
      experimental: true,
    };
  }

  if (!classifier) {
    return { ...FAILED_RESULT };
  }

  try {
    const prediction = classifier(trimmed);
    const experimental = Boolean(prediction.experimental ?? true);

    if (prediction.status === 'predicted' && prediction.label && VALID_LABELS.has(prediction.label)) {
      return {
        status: 'predicted',
        label: prediction.label,
        model: MODEL_NAME,
        experimental,
      };
    }

    if (prediction.status === 'unknown_vocabulary' || prediction.status === 'empty_input') {
      return {
        status: prediction.status,
        label: null,
        model: MODEL_NAME,
        experimental,
      };
    }

    return { ...FAILED_RESULT };
  } catch {
    return { ...FAILED_RESULT };
  }
}
