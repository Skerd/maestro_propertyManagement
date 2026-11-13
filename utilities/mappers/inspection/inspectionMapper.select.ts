import * as path from "path";
import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {loadEmailStrings, resolveEmailLocaleTag} from "@coreModule/utilities/emails/emailLocale";
import {IInspection} from "../../../database/schemas/inspection/inspection";

// The picker's labels are written on the server, so the type names live beside it, as carRental's pricing labels do.
const LOCALES_ROOT = path.join(__dirname, "..", "..", "inspection", "static", "locales");

/** "20 Nov 2026" in the caller's language: the panel's medium date, read as a calendar day (GLB-09). */
function calendarDay(day: string, localeTag: string): string {
    const date = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return day;
    return new Intl.DateTimeFormat(localeTag, {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}).format(date);
}

/** "Routine · 20 Nov 2026", like the inspection links on the sheet (TD-B211); the code only when neither is known. */
export function inspectionsToSelect(inspections: IInspection[], languageCode: string): ApiSelectDatum[] {
    const localeTag = resolveEmailLocaleTag(languageCode);
    const types = loadEmailStrings(["inspectionType"], localeTag, LOCALES_ROOT);
    return inspections.map((inspection) => {
        const parts = [
            inspection.type ? types[inspection.type] ?? inspection.type : "",
            inspection.inspectionDate ? calendarDay(inspection.inspectionDate, localeTag) : "",
        ].filter((part) => part !== "");
        return {
            value: inspection._id.toString(),
            label: parts.length > 0 ? parts.join(" · ") : inspection.name || inspection._id.toString(),
        };
    });
}
