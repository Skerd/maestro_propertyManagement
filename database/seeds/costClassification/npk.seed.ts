/**
 * NPK — Normpositionen-Katalog (CRB). Chapter skeleton for Devisierung /
 * Leistungsverzeichnis (§3.B). SKELETON: common chapter headers only — individual
 * NPK positions are CRB-licensed content and are handled at LV time, with
 * R-Positionen (free positions) covering anything not in the seeded catalogue.
 * Provenance: CRB NPK chapter numbering.
 */
import type {CostClassificationSeedRow} from "./ebkpH.seed";

const STANDARD = "npk";

export const npkSeed: CostClassificationSeedRow[] = [
    {standard: STANDARD, code: "102", level: 1, title: "Bauaushub", sortIndex: 10},
    {standard: STANDARD, code: "113", level: 1, title: "Baustelleneinrichtung", sortIndex: 20},
    {standard: STANDARD, code: "151", level: 1, title: "Abbrüche, Demontagen, Umbau", sortIndex: 30},
    {standard: STANDARD, code: "211", level: 1, title: "Baumeisterarbeiten", sortIndex: 40},
    {standard: STANDARD, code: "221", level: 1, title: "Fenster aus Holz und Holzmetall", sortIndex: 50},
    {standard: STANDARD, code: "222", level: 1, title: "Spenglerarbeiten", sortIndex: 60},
    {standard: STANDARD, code: "224", level: 1, title: "Bedachungsarbeiten", sortIndex: 70},
    {standard: STANDARD, code: "228", level: 1, title: "Storen und Rollläden", sortIndex: 80},
    {standard: STANDARD, code: "241", level: 1, title: "Heizungsanlagen", sortIndex: 90},
    {standard: STANDARD, code: "244", level: 1, title: "Lufttechnische Anlagen", sortIndex: 100},
    {standard: STANDARD, code: "251", level: 1, title: "Sanitäranlagen", sortIndex: 110},
    {standard: STANDARD, code: "271", level: 1, title: "Gipserarbeiten", sortIndex: 120},
    {standard: STANDARD, code: "281", level: 1, title: "Bodenbeläge", sortIndex: 130},
    {standard: STANDARD, code: "285", level: 1, title: "Malerarbeiten innen", sortIndex: 140},
    {standard: STANDARD, code: "643", level: 1, title: "Elektroinstallationen", sortIndex: 150},
];
