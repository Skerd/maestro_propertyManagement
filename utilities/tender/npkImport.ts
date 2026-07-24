import {ClientSession} from "mongoose";
import * as crypto from "crypto";
import dayjs from "dayjs";
import {serverLogger} from "@coreModule/loggers/serverLog";
import CostClassification from "@propertyManagement/database/schemas/costClassification/costClassification";
import SpecificationItem from "@propertyManagement/database/schemas/specificationItem/specificationItem";

interface ImportNpkArgs {
    specification: any;      // ISpecification document (has _id, project, currency, company)
    companyId: any;
    codes?: string[];        // optional subset of NPK codes; empty/omitted = all active NPK chapters
    session?: ClientSession;
    logger?: serverLogger;
    auditUserId?: any;
}

/**
 * Seeds Leistungsverzeichnis positions from the company's NPK CostClassification
 * reference rows (Phase 1). Idempotent per (specification, classificationCode):
 * chapters already imported into this LV are skipped, so re-running only adds
 * newly available NPK chapters.
 */
export async function importNpkPositionsIntoSpecification(args: ImportNpkArgs): Promise<number> {
    const {specification, companyId, codes, session, logger, auditUserId} = args;

    const ccFilter: Record<string, any> = {company: companyId, standard: "npk", active: true, deletedAt: null};
    if (codes && codes.length) ccFilter.code = {$in: codes};

    const npkRows = await CostClassification.find(ccFilter)
        .sort({sortIndex: 1, code: 1})
        .session(session ?? null)
        .lean();
    if (!npkRows.length) return 0;

    const existing = await SpecificationItem.find({
        company: companyId,
        specification: specification._id,
        classificationStandard: "npk",
        deletedAt: null,
    }).select("classificationCode").session(session ?? null).lean();
    const already = new Set(existing.map((e: any) => String(e.classificationCode)));

    const date = dayjs().format("YYYYMMDD");
    const toInsert = npkRows
        .filter((row: any) => !already.has(String(row.code)))
        .map((row: any) => ({
            name: `LVP-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
            specification: specification._id,
            project: specification.project,
            title: row.title,
            npkChapter: row.code,
            npkPosition: row.code,
            isRPosition: false,
            unitOfMeasure: row.unitOfMeasure,
            classificationStandard: "npk",
            classificationCode: row.code,
            currency: specification.currency,
            sortIndex: row.sortIndex,
            status: "active",
            company: companyId,
            createdBy: auditUserId ?? specification.createdBy,
        }));

    if (!toInsert.length) {
        logger?.debug?.(`importNpkPositions: nothing new to import for specification ${String(specification._id)}`);
        return 0;
    }

    await SpecificationItem.insertMany(toInsert, {session: session ?? undefined});
    logger?.debug?.(`importNpkPositions: created ${toInsert.length} LV positions for specification ${String(specification._id)}`);
    return toInsert.length;
}
