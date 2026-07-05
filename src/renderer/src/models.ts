export interface CuratedModel {
  tag: string
  title: string
  blurb: string
  downloadGB: number
  ramGB: number
}

export const CURATED: CuratedModel[] = [
  {
    tag: 'llama3.1:8b',
    title: 'Llama 3.1 8B',
    blurb: 'Fast all-rounder — a great first model',
    downloadGB: 4.9,
    ramGB: 8
  },
  {
    tag: 'qwen2.5-coder:7b',
    title: 'Qwen2.5 Coder 7B',
    blurb: 'Best for writing and explaining code',
    downloadGB: 4.7,
    ramGB: 8
  },
  {
    tag: 'qwen3:14b',
    title: 'Qwen3 14B',
    blurb: 'Stronger reasoning, still quick',
    downloadGB: 9.3,
    ramGB: 13
  },
  {
    tag: 'qwen3:30b',
    title: 'Qwen3 30B',
    blurb: 'Best overall quality — fast for its size (MoE)',
    downloadGB: 19,
    ramGB: 23
  },
  {
    tag: 'gemma3:27b',
    title: 'Gemma 3 27B',
    blurb: 'Excellent writing, can look at images',
    downloadGB: 17,
    ramGB: 21
  },
  {
    tag: 'gemma3:4b',
    title: 'Gemma 3 4B',
    blurb: 'Light and snappy on any machine',
    downloadGB: 3.3,
    ramGB: 5
  }
]

export type Fit = 'great' | 'slow' | 'no'

// A model needs its weights plus KV cache and OS headroom in unified memory;
// past ~75% of total RAM things start swapping and crawl.
export function fitFor(model: CuratedModel, totalMemGB: number): Fit {
  if (model.ramGB <= totalMemGB * 0.75) return 'great'
  if (model.ramGB <= totalMemGB) return 'slow'
  return 'no'
}

export function recommendedTag(totalMemGB: number): string {
  const fits = CURATED.filter((m) => fitFor(m, totalMemGB) === 'great')
  if (fits.length === 0) return CURATED[CURATED.length - 1].tag
  return fits.reduce((a, b) => (b.ramGB > a.ramGB ? b : a)).tag
}
