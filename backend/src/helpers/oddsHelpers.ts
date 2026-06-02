// ─────────────────────────────────────────────────────────────────────────────
// Helpers partagés pour l'analyse des cotes et des résultats
// ─────────────────────────────────────────────────────────────────────────────

export interface OddsTriple { home: number; draw: number; away: number }
export interface OverUnderLine { total: string; over: number; under: number }

// ─── Extraction des données brutes ───────────────────────────────────────────

export function getStoredMatches(oddsData: any): any[] {
  if (Array.isArray(oddsData?.matches) && oddsData.matches.length > 0) {
    return oddsData.matches;
  }
  if (Array.isArray(oddsData?.round?.matches)) {
    return oddsData.round.matches;
  }
  if (Array.isArray(oddsData?.matches)) {
    return oddsData.matches;
  }
  return [];
}

/**
 * Extrait les cotes 1X2 d'un match individuel (à l'intérieur de odds_data.round.matches[])
 */
export function extract1X2(eventBetTypes: any[]): OddsTriple | null {
  if (!eventBetTypes) return null;
  const bt = eventBetTypes.find((b: any) => b.name === '1X2');
  if (!bt?.eventBetTypeItems) return null;
  const items = bt.eventBetTypeItems;
  const home = items.find((i: any) => i.shortName === '1')?.odds;
  const draw = items.find((i: any) => i.shortName === 'X')?.odds;
  const away = items.find((i: any) => i.shortName === '2')?.odds;
  if (home == null || draw == null || away == null) return null;
  return { home, draw, away };
}

/**
 * Extrait les cotes Over/Under (+/-) d'un match — toutes les lignes disponibles
 */
export function extractOverUnder(eventBetTypes: any[]): OverUnderLine[] {
  if (!Array.isArray(eventBetTypes)) return [];
  const result: OverUnderLine[] = [];
  for (const bt of eventBetTypes) {
    if (bt.name !== '+/-') continue;

    // total peut être dans bt.betTypeContext ou dans bt.eventBetTypeItems[*].betTypeContext
    let total = '';
    try { total = JSON.parse(bt.betTypeContext ?? '{}')?.total ?? ''; } catch { /**/ }
    if (!total) {
      // Fallback : chercher dans le premier item
      const firstItem = (bt.eventBetTypeItems ?? [])[0];
      try { total = JSON.parse(firstItem?.betTypeContext ?? '{}')?.total ?? ''; } catch { /**/ }
    }
    if (!total) continue;

    const items: any[] = bt.eventBetTypeItems ?? [];
    if (items.length < 2) continue;

    // Stratégie 1 : par shortName (> / <)
    let overItem  = items.find((i: any) => String(i.shortName ?? '').includes('>'));
    let underItem = items.find((i: any) => String(i.shortName ?? '').includes('<'));

    // Stratégie 2 : par position (index 0 = over, index 1 = under)
    if (!overItem || !underItem) {
      overItem  = items[0];
      underItem = items[1];
    }

    const overOdds  = overItem?.odds  ?? overItem?.value;
    const underOdds = underItem?.odds ?? underItem?.value;

    if (overOdds != null && underOdds != null) {
      result.push({ total, over: overOdds, under: underOdds });
    }
  }
  // Trier par valeur de total croissante (0.5, 1.5, 2.5...)
  result.sort((a, b) => parseFloat(a.total) - parseFloat(b.total));
  return result;
}

/**
 * Extrait tous les sous-matchs d'un round avec leurs cotes 1X2
 */
export function extractRoundMatches(oddsData: any): Array<{
  matchId: number;
  oddsId?: number;
  name: string;
  homeTeam: string;
  awayTeam: string;
  odds: OddsTriple;
  overUnder: OverUnderLine[];
}> {
  const matches = getStoredMatches(oddsData);
  const result: any[] = [];
  for (const m of matches) {
    const odds = extract1X2(m.eventBetTypes);
    if (odds) {
      result.push({
        matchId:  m.id,
        oddsId:   m.odds_id,
        name:     m.name ?? `${m.homeTeam?.name ?? '?'} vs ${m.awayTeam?.name ?? '?'}`,
        homeTeam: m.homeTeam?.name ?? '?',
        awayTeam: m.awayTeam?.name ?? '?',
        odds,
        overUnder: extractOverUnder(m.eventBetTypes),
      });
    }
  }
  return result;
}

/**
 * Distance euclidienne entre deux triplets de cotes
 */
export function oddsDistance(a: OddsTriple, b: OddsTriple): number {
  return Math.sqrt(
    (a.home - b.home) ** 2 +
    (a.draw - b.draw) ** 2 +
    (a.away - b.away) ** 2,
  );
}

/**
 * Distance euclidienne au carré (évite Math.sqrt pour les filtres)
 */
export function oddsDistanceSquared(a: OddsTriple, b: OddsTriple): number {
  return (
    (a.home - b.home) ** 2 +
    (a.draw - b.draw) ** 2 +
    (a.away - b.away) ** 2
  );
}

/**
 * Clé stable pour comparer rapidement des cotes identiques (tolérance = 0)
 */
export function oddsKey(odds: OddsTriple, precision = 3): string {
  return `${odds.home.toFixed(precision)}|${odds.draw.toFixed(precision)}|${odds.away.toFixed(precision)}`;
}

// ─── Matching par équipes ─────────────────────────────────────────────────────

/**
 * Clé de matching par noms d'équipes (insensible à la casse)
 */
export function teamKey(homeTeam: any, awayTeam: any): string {
  const h = (typeof homeTeam === 'object' ? homeTeam?.name : homeTeam) ?? '';
  const a = (typeof awayTeam === 'object' ? awayTeam?.name : awayTeam) ?? '';
  return `${String(h).trim().toLowerCase()}|${String(a).trim().toLowerCase()}`;
}

// ─── Extraction des scores ────────────────────────────────────────────────────

/**
 * Extrait le score final depuis result_data.
 * Stratégie de matching (dans l'ordre) :
 *   1. Par matchId direct
 *   2. Par noms d'équipes (homeTeam|awayTeam)
 *   3. Par index positionnel (dernier recours)
 */
export function extractScore(
  resultData: any,
  matchId: number,
  oddsId: number | undefined,
  index: number,
  homeTeam?: string,
  awayTeam?: string,
): { homeScore: number; awayScore: number; matchMethod: string } | null {
  if (!resultData?.matches) return null;
  const rms: any[] = resultData.matches;

  // 1. Par matchId
  let rm = rms.find((m: any) => m.id === matchId);
  let method = 'id';

  // 2. Par noms d'équipes
  if (!rm && homeTeam && awayTeam) {
    const key = teamKey(homeTeam, awayTeam);
    rm = rms.find((m: any) => teamKey(m.homeTeam, m.awayTeam) === key);
    if (rm) method = 'name';
  }

  // 3. Par index positionnel
  if (!rm && index < rms.length) {
    rm = rms[index];
    method = 'index';
  }

  if (!rm) return null;

  if (typeof rm.homeScore === 'number' && typeof rm.awayScore === 'number') {
    return { homeScore: rm.homeScore, awayScore: rm.awayScore, matchMethod: method };
  }
  const goals = rm.goals ?? [];
  if (goals.length === 0) return { homeScore: 0, awayScore: 0, matchMethod: method };
  const last = goals[goals.length - 1];
  return {
    homeScore: Math.round(last.homeScore ?? 0),
    awayScore: Math.round(last.awayScore ?? 0),
    matchMethod: method,
  };
}
