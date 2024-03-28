export type DurationUnit = string | ((unitCount: number) => string);

export type DurationUnitName = "y" | "mo" | "w" | "d" | "h" | "m" | "s" | "ms";

export interface DurationUnitMeasures {
  y: number;
  mo: number;
  w: number;
  d: number;
  h: number;
  m: number;
  s: number;
  ms: number;
}

export type DurationDigitReplacements = [string, string, string, string, string, string, string, string, string, string];

export interface DurationLanguage {
  y: DurationUnit;
  mo: DurationUnit;
  w: DurationUnit;
  d: DurationUnit;
  h: DurationUnit;
  m: DurationUnit;
  s: DurationUnit;
  ms: DurationUnit;
  future?: string;
  past?: string;
  decimal?: string;
  delimiter?: string;
  _digitReplacements?: DurationDigitReplacements;
  _numberFirst?: boolean;
}

export interface DurationOptions {
  language?: DurationLanguage;
  fallbacks?: string[];
  delimiter?: string;
  spacer?: string;
  round?: boolean;
  largest?: number;
  units?: DurationUnitName[];
  decimal?: string;
  conjunction?: string;
  maxDecimalPoints?: number;
  unitMeasures?: DurationUnitMeasures;
  serialComma?: boolean;
  digitReplacements?: DurationDigitReplacements;
  timeAdverb?: boolean;
}

export interface DurationPiece {
  unitName: DurationUnitName;
  unitCount: number;
}
