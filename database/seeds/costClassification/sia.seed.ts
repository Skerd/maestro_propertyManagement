/**
 * SIA — Leistungsphasen skeleton (SIA 102 architects / 103 civil engineers /
 * 108 building services). Reference rows for fee agreements (Honorarberechnung, §3.H).
 * SKELETON: the six SIA phases with the standard SIA 102 phase-percentage default
 * carried in unitOfMeasure ("% of total fee") and title. The actual editable
 * fee percentages live on ConsultantAppointment.siaPhasePercentages (Phase 4).
 * Provenance: SIA 102 (2020) Teilphasen / Leistungsphasen.
 */
import type {CostClassificationSeedRow} from "./ebkpH.seed";

const STANDARD = "sia";
const PCT = "% Honorar";

export const siaSeed: CostClassificationSeedRow[] = [
    {standard: STANDARD, code: "SIA102-1", level: 1, title: "Strategische Planung", unitOfMeasure: PCT, sortIndex: 10},
    {standard: STANDARD, code: "SIA102-2", level: 1, title: "Vorstudien (Machbarkeit / Auswahlverfahren)", unitOfMeasure: PCT, sortIndex: 20},
    {standard: STANDARD, code: "SIA102-3", level: 1, title: "Projektierung (Vorprojekt / Bauprojekt / Bewilligung)", unitOfMeasure: PCT, sortIndex: 30},
    {standard: STANDARD, code: "SIA102-31", parentCode: "SIA102-3", level: 2, title: "Vorprojekt (ca. 9%)", unitOfMeasure: PCT, sortIndex: 31},
    {standard: STANDARD, code: "SIA102-32", parentCode: "SIA102-3", level: 2, title: "Bauprojekt (ca. 21%)", unitOfMeasure: PCT, sortIndex: 32},
    {standard: STANDARD, code: "SIA102-33", parentCode: "SIA102-3", level: 2, title: "Bewilligungsverfahren (ca. 2%)", unitOfMeasure: PCT, sortIndex: 33},
    {standard: STANDARD, code: "SIA102-4", level: 1, title: "Ausschreibung (Ausschreibung / Vergleich / Vergabeantrag)", unitOfMeasure: PCT, sortIndex: 40},
    {standard: STANDARD, code: "SIA102-41", parentCode: "SIA102-4", level: 2, title: "Ausschreibung, Offertvergleich, Vergabeantrag (ca. 18%)", unitOfMeasure: PCT, sortIndex: 41},
    {standard: STANDARD, code: "SIA102-5", level: 1, title: "Realisierung (Ausführungsprojekt / Ausführung / Inbetriebnahme)", unitOfMeasure: PCT, sortIndex: 50},
    {standard: STANDARD, code: "SIA102-51", parentCode: "SIA102-5", level: 2, title: "Ausführungsprojekt (ca. 15%)", unitOfMeasure: PCT, sortIndex: 51},
    {standard: STANDARD, code: "SIA102-52", parentCode: "SIA102-5", level: 2, title: "Ausführung (ca. 33%)", unitOfMeasure: PCT, sortIndex: 52},
    {standard: STANDARD, code: "SIA102-53", parentCode: "SIA102-5", level: 2, title: "Inbetriebnahme, Abschluss (ca. 1%)", unitOfMeasure: PCT, sortIndex: 53},
    {standard: STANDARD, code: "SIA102-6", level: 1, title: "Bewirtschaftung", unitOfMeasure: PCT, sortIndex: 60},
];
