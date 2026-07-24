/**
 * eBKP-H — Baukostenplan Hochbau (SN 506 511, CRB).
 * Element-based cost classification. SKELETON: main element groups (A–J, V, W)
 * plus a few level-2 elements under C/D to demonstrate the hierarchy.
 * Provenance: CRB SN 506 511. Full element/sub-element catalogue is CRB-licensed —
 * extend or import the licensed set; R-Positionen cover anything not seeded.
 */
export interface CostClassificationSeedRow {
    standard: string;
    code: string;
    parentCode?: string;
    level: number;
    title: string;
    unitOfMeasure?: string;
    sortIndex: number;
}

const STANDARD = "ebkp_h";

export const ebkpHSeed: CostClassificationSeedRow[] = [
    {standard: STANDARD, code: "A", level: 1, title: "Grundstück", sortIndex: 10},
    {standard: STANDARD, code: "B", level: 1, title: "Vorbereitung", sortIndex: 20},
    {standard: STANDARD, code: "C", level: 1, title: "Konstruktion Gebäude", sortIndex: 30},
    {standard: STANDARD, code: "C 1", parentCode: "C", level: 2, title: "Fundation, Baugrube", sortIndex: 31},
    {standard: STANDARD, code: "C 2", parentCode: "C", level: 2, title: "Wandkonstruktion", sortIndex: 32},
    {standard: STANDARD, code: "C 3", parentCode: "C", level: 2, title: "Stützenkonstruktion", sortIndex: 33},
    {standard: STANDARD, code: "C 4", parentCode: "C", level: 2, title: "Deckenkonstruktion", sortIndex: 34},
    {standard: STANDARD, code: "D", level: 1, title: "Technik Gebäude", sortIndex: 40},
    {standard: STANDARD, code: "D 1", parentCode: "D", level: 2, title: "Elektroanlage", sortIndex: 41},
    {standard: STANDARD, code: "D 5", parentCode: "D", level: 2, title: "Wärme-, Kälte-, Lufttechnische Anlage", sortIndex: 45},
    {standard: STANDARD, code: "D 7", parentCode: "D", level: 2, title: "Sanitäranlage", sortIndex: 47},
    {standard: STANDARD, code: "E", level: 1, title: "Äussere Wandbekleidung Gebäude", sortIndex: 50},
    {standard: STANDARD, code: "F", level: 1, title: "Bedachung Gebäude", sortIndex: 60},
    {standard: STANDARD, code: "G", level: 1, title: "Ausbau Gebäude", sortIndex: 70},
    {standard: STANDARD, code: "H", level: 1, title: "Nutzungsspezifische Anlage Gebäude", sortIndex: 80},
    {standard: STANDARD, code: "I", level: 1, title: "Umgebung Gebäude", sortIndex: 90},
    {standard: STANDARD, code: "J", level: 1, title: "Ausstattung Gebäude", sortIndex: 100},
    {standard: STANDARD, code: "V", level: 1, title: "Planungskosten", sortIndex: 110},
    {standard: STANDARD, code: "W", level: 1, title: "Nebenkosten zu V", sortIndex: 120},
];
