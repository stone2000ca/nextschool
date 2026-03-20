/**
 * computeSectionConfidence — E50-S2A
 *
 * Returns a confidence bucket for each ResearchNotepad section
 * based on the richness of the underlying data.
 */

export type ConfidenceLevel = 'strong' | 'limited' | 'unknown';

export type SectionKey = 'fit' | 'tradeoffs' | 'money' | 'visitprep';

interface TradeOff {
  dimension?: string;
  strength?: string;
  concern?: string;
  data_source?: string;
}

interface PriorityMatch {
  priority?: string;
  status?: string;
  detail?: string;
}

interface FinancialSummary {
  tuition?: number | null;
  aid_available?: boolean | null;
  estimated_net_cost?: number | null;
  budget_fit?: string | null;
}

interface VisitPrepKit {
  visitQuestions?: unknown[];
  observations?: unknown[];
  redFlags?: unknown[];
}

interface KeyDate {
  date?: string;
  label?: string;
}

export interface SectionData {
  priorityMatches?: PriorityMatch[] | null;
  tradeOffs?: TradeOff[] | null;
  financialSummary?: FinancialSummary | null;
  visitPrepKit?: VisitPrepKit | null;
  keyDates?: KeyDate[] | null;
}

export function computeSectionConfidence(
  section: SectionKey,
  data: SectionData,
): ConfidenceLevel {
  switch (section) {
    case 'fit': {
      const rows = (data.priorityMatches || []).filter(
        (p) => p.status && p.status !== 'unknown',
      );
      if (rows.length >= 3) return 'strong';
      if (rows.length >= 1) return 'limited';
      return 'unknown';
    }

    case 'tradeoffs': {
      const items = (data.tradeOffs || []).filter(
        (t) => t.dimension && (t.strength || t.concern),
      );
      if (items.length >= 3) return 'strong';
      if (items.length >= 1) return 'limited';
      return 'unknown';
    }

    case 'money': {
      const fs = data.financialSummary;
      if (!fs || !fs.tuition || fs.tuition <= 0) return 'unknown';
      if (fs.aid_available === true) return 'strong';
      return 'limited';
    }

    case 'visitprep': {
      const hasSpecificDates =
        (data.keyDates || []).filter((d) => d.date).length > 0;
      const questionCount =
        data.visitPrepKit?.visitQuestions?.length ?? 0;

      if (hasSpecificDates && questionCount >= 2) return 'strong';
      if (hasSpecificDates || questionCount >= 1 || data.visitPrepKit)
        return 'limited';
      return 'unknown';
    }

    default:
      return 'unknown';
  }
}

/** Label copy for each confidence level */
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  strong: 'Based on strong data',
  limited: 'Based on limited data',
  unknown: "We can't fully assess this yet",
};
