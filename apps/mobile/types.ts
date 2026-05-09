export type AccessoryCategory = {
  label: string;
  search_terms: string[];
  confidence: number;
  reasoning?: string;
};

export type VisionResult = {
  object: string;
  attributes: string[];
  accessory_categories: AccessoryCategory[];
};

export type PrintResult = {
  source: 'printables' | 'makerworld';
  category: string;
  title: string;
  url: string;
  thumbnail?: string;
  likes?: number;
  downloads?: number;
  score: number;
};

export type SearchResponse = {
  search_id: string;
  cached: boolean;
  vision: VisionResult;
  results: PrintResult[];
};
