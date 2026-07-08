import {ClientSession} from "mongoose";
import {ObjectId} from "mongodb";
import Unit from "../../../database/schemas/unit/unit";

export type CommissionRateChannel = "sale" | "reservation";

function clampRate(n: number): number {
    if (!Number.isFinite(n)) {
        return 0;
    }
    return Math.min(100, Math.max(0, n));
}

function normalizedCommissionRatePercent(raw: unknown): number | undefined {

    if (raw == null) {
        return undefined;
    }
    if (typeof raw === "number" && !Number.isNaN(raw)) {
        return clampRate(raw);
    }
    if (typeof raw === "object" && typeof (raw as {toString?: () => string}).toString === "function") {
        const n = parseFloat((raw as {toString: () => string}).toString());
        if (!Number.isNaN(n)) {
            return clampRate(n);
        }
    }
    return undefined;
}

function pickRate(unitDoc: any, projectDoc: any, channel: CommissionRateChannel): number | undefined {
    const unitKey = channel === "sale" ? "saleCommissionRatePercent" : "reservationCommissionRatePercent";

    const foundUnitRate = normalizedCommissionRatePercent(unitDoc?.[unitKey]);
    if (foundUnitRate !== undefined) {
        return foundUnitRate;
    }
    const foundProjectRate = normalizedCommissionRatePercent(projectDoc?.[unitKey]);
    if (foundProjectRate !== undefined) {
        return foundProjectRate;
    }
    return undefined;
}

export async function resolveCommissionRatePercent(params: { unitId: ObjectId; companyId: ObjectId; channel: CommissionRateChannel; session?: ClientSession; }): Promise<number> {
    const {unitId, companyId, channel, session} = params;
    const unit = await Unit.findOne({_id: unitId, company: companyId})
        .populate({
            path: "floor",
            populate: {
                path: "edifice",
                populate: {path: "project"}
            }
        })
        .session(session ?? null)
        .exec();


    if (!unit) {
        return 0;
    }
    else{
        const project = unit.floor?.edifice?.project;
        const resolved = pickRate(unit, project, channel);
        if (resolved !== undefined) {
            return resolved;
        }
    }
    return 0;
}
