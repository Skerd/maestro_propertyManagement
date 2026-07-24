/**
 * BKP — Baukostenplan (SN 506 500, CRB). Account plan (Kontenplan) used for
 * account allocation of contractor invoices (§3.G) and the cost-control ledger (§3.I).
 * SKELETON: 1-digit main groups (Hauptgruppen) + common 3-digit accounts under
 * group 2 (Gebäude). Provenance: CRB SN 506 500 — full account list is CRB-licensed.
 */
import type {CostClassificationSeedRow} from "./ebkpH.seed";

const STANDARD = "bkp";

export const bkpSeed: CostClassificationSeedRow[] = [
    {standard: STANDARD, code: "0", level: 1, title: "Grundstück", sortIndex: 10},
    {standard: STANDARD, code: "1", level: 1, title: "Vorbereitungsarbeiten", sortIndex: 20},
    {standard: STANDARD, code: "2", level: 1, title: "Gebäude", sortIndex: 30},
    {standard: STANDARD, code: "20", parentCode: "2", level: 2, title: "Baugrube", sortIndex: 31},
    {standard: STANDARD, code: "21", parentCode: "2", level: 2, title: "Rohbau 1", sortIndex: 32},
    {standard: STANDARD, code: "211", parentCode: "21", level: 3, title: "Baumeisterarbeiten", sortIndex: 321},
    {standard: STANDARD, code: "214", parentCode: "21", level: 3, title: "Montagebau in Holz", sortIndex: 324},
    {standard: STANDARD, code: "22", parentCode: "2", level: 2, title: "Rohbau 2", sortIndex: 33},
    {standard: STANDARD, code: "221", parentCode: "22", level: 3, title: "Fenster, Aussentüren, Tore", sortIndex: 331},
    {standard: STANDARD, code: "23", parentCode: "2", level: 2, title: "Elektroanlagen", sortIndex: 34},
    {standard: STANDARD, code: "24", parentCode: "2", level: 2, title: "Heizungs-, Lüftungs-, Klimaanlagen", sortIndex: 35},
    {standard: STANDARD, code: "25", parentCode: "2", level: 2, title: "Sanitäranlagen", sortIndex: 36},
    {standard: STANDARD, code: "27", parentCode: "2", level: 2, title: "Ausbau 1", sortIndex: 37},
    {standard: STANDARD, code: "28", parentCode: "2", level: 2, title: "Ausbau 2", sortIndex: 38},
    {standard: STANDARD, code: "29", parentCode: "2", level: 2, title: "Honorare", sortIndex: 39},
    {standard: STANDARD, code: "3", level: 1, title: "Betriebseinrichtungen", sortIndex: 40},
    {standard: STANDARD, code: "4", level: 1, title: "Umgebung", sortIndex: 50},
    {standard: STANDARD, code: "5", level: 1, title: "Baunebenkosten", sortIndex: 60},
    {standard: STANDARD, code: "8", level: 1, title: "Unvorhergesehenes", sortIndex: 70},
    {standard: STANDARD, code: "9", level: 1, title: "Ausstattung", sortIndex: 80},
];
