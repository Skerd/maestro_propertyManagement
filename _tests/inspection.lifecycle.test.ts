/** TD-B198: an inspection moves scheduled → in progress → completed through its own actions; completing needs a finished checklist. */
import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";
import {InspectionActions} from "@propertyManagement/database/schemas/inspection/inspection.actions";
import {actor, asTenant, clearDatabase, findRaw} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const params = actor(companyId);
const inspections = new InspectionActions();
const db = () => mongoose.connection.db!;

beforeAll(async () => {
    await connectTestDatabase();
});

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(clearDatabase));

/** An inspection in `status`; with `checklist`, a template of those items, done or not as given. */
async function seedInspection(status: string, checklist?: {name: string; completed: boolean}[]): Promise<ObjectId> {
    const _id = new ObjectId();
    let checklistTemplate: ObjectId | undefined;
    const checklistItems = [];
    if (checklist) {
        checklistTemplate = new ObjectId();
        const items = checklist.map((item) => ({_id: new ObjectId(), name: item.name}));
        await db().collection("inspectionchecklisttemplates").insertOne({_id: checklistTemplate, company: companyId, name: `Handover ${checklistTemplate}`, items, deletedAt: null});
        checklistItems.push(...items.map((item, index) => ({
            _id: new ObjectId(), sourceTemplateId: checklistTemplate, sourceItemId: item._id, name: item.name,
            completed: checklist[index].completed, retained: false,
        })));
    }
    await db().collection("inspections").insertOne({
        _id, company: companyId, unit: new ObjectId(), inspectedBy: new ObjectId(), name: `INSP-${_id}`, type: "routine",
        inspectionDate: "2026-11-20", status, followUpRequired: false, media: [], checklistTemplate, checklistItems, deletedAt: null,
    });
    return _id;
}

const start = (_id: ObjectId) => inspections.start({...params, _id: _id.toString()});
const complete = (_id: ObjectId) => inspections.complete({...params, _id: _id.toString()});

describe("inspection lifecycle", {timeout: 60000}, () => {
    it("starts a scheduled or rescheduled inspection, and refuses any other", () => asCompany(async () => {
        const scheduled = await seedInspection("scheduled");
        const rescheduled = await seedInspection("rescheduled");
        await start(scheduled);
        await start(rescheduled);
        expect((await findRaw("inspections", scheduled))!.status).toBe("in_progress");
        expect((await findRaw("inspections", rescheduled))!.status).toBe("in_progress");

        for (const status of ["in_progress", "completed", "cancelled"]) {
            const other = await seedInspection(status);
            await expect(start(other)).rejects.toMatchObject({error_code: "invalid_status_for_start_inspection"});
            expect((await findRaw("inspections", other))!.status).toBe(status);
        }
    }));

    it("completes an inspection in progress once its checklist is done, stamping the time", () => asCompany(async () => {
        const open = await seedInspection("in_progress", [{name: "Windows", completed: true}, {name: "Doors", completed: false}]);
        await expect(complete(open)).rejects.toMatchObject({error_code: "inspection_checklist_incomplete"});
        expect((await findRaw("inspections", open))!.status).toBe("in_progress");

        const done = await seedInspection("in_progress", [{name: "Windows", completed: true}]);
        await complete(done);
        const row = (await findRaw("inspections", done))!;
        expect(row.status).toBe("completed");
        expect(row.completedAt).toBeInstanceOf(Date);

        const noChecklist = await seedInspection("in_progress");
        await complete(noChecklist);
        expect((await findRaw("inspections", noChecklist))!.status).toBe("completed");
    }));

    it("refuses to complete an inspection that was never started", () => asCompany(async () => {
        const scheduled = await seedInspection("scheduled");
        await expect(complete(scheduled)).rejects.toMatchObject({error_code: "invalid_status_for_complete_inspection"});
        expect((await findRaw("inspections", scheduled))!.status).toBe("scheduled");
    }));
});
