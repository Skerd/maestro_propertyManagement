/**
 * TD-B232: the brochure import writes its floors and units in core's runInTransaction, whose transaction is already
 * open on the server when the write phase's first read runs. The PDF generator and GridFS are stubbed: the test is
 * about the write phase, not the brochure parsing.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import {ObjectId} from "mongodb";
import {PDFDocument} from "pdf-lib";
import {connectTestDatabase, disconnectTestDatabase} from "@coreModule/_tests/testDatabase";

vi.mock("@propertyManagement/utilities/edifice/floorAndUnitsGenerator/extractPdfPages", () => ({
    // One floor with one unit, and the floor plan image the generator would have written.
    processPdfForFloorsAndUnits: async (_inputPath: string, outputRoot: string) => {
        const floorFolder = path.join(outputRoot, "floors", "K1");
        fs.mkdirSync(floorFolder, {recursive: true});
        fs.writeFileSync(path.join(floorFolder, "floor-plan.png"), Buffer.from("png"));
        return {floors: {K1: {floor: "Kati 1", units: {"A-1": [{totalArea: 90, netArea: 80, sharedArea: 10, verandaArea: 5}]}}}};
    },
}));

import {GridFSStorage} from "@coreModule/utilities/gridfs/gridfsStorage";
import {EdificeActions} from "@propertyManagement/database/schemas/edifice/edifice.actions";
import {floorService} from "@propertyManagement/database/schemas/floor/floor.service";
import Floor from "@propertyManagement/database/schemas/floor/floor";
import Unit from "@propertyManagement/database/schemas/unit/unit";
import {actor, asTenant, clearDatabase, seedCurrency} from "./sale.fixtures";

const companyId = new ObjectId();
const asCompany = asTenant(companyId);
const db = () => mongoose.connection.db!;

beforeAll(async () => {
    await connectTestDatabase();
}, 120000);

afterAll(async () => {
    await disconnectTestDatabase();
});

beforeEach(() => asCompany(clearDatabase));

describe("brochure import of floors and units (TD-B232)", {timeout: 60000}, () => {
    it("writes them in one transaction, opened on the server before the write phase's first read", () => asCompany(async () => {
        const project = new ObjectId();
        const edifice = new ObjectId();
        const brochure = new ObjectId();
        await db().collection("edifices").insertOne({_id: edifice, company: companyId, project, name: "Building A", deletedAt: null});
        await db().collection("unittypes").insertOne({_id: new ObjectId(), company: companyId, name: "Apartment", deletedAt: null});
        await db().collection("media").insertOne({_id: brochure, company: companyId, fileId: new ObjectId(), type: "pdf", deletedAt: null});
        await seedCurrency(companyId, "EUR");

        const pdf = await PDFDocument.create();
        pdf.addPage();
        const pdfBuffer = Buffer.from(await pdf.save());
        vi.spyOn(GridFSStorage.prototype, "getFileBuffer").mockResolvedValue(pdfBuffer);
        vi.spyOn(GridFSStorage.prototype, "uploadFile").mockImplementation(async () => new ObjectId());
        vi.spyOn(GridFSStorage.prototype, "deleteFile").mockResolvedValue(undefined);

        const find = floorService.find.bind(floorService);
        const openedFirst: boolean[] = [];
        vi.spyOn(floorService, "find").mockImplementation((query, options = {}, ...rest) => {
            const {session} = options;
            // Only the write phase reads on a session; the reads before the uploads run without one.
            if (session) openedFirst.push(session.inTransaction() && !session.transaction.isStarting);
            return find(query, options, ...rest);
        });

        try {
            const result = await new EdificeActions().generateFloorsUnits({
                ...actor(companyId),
                _id: edifice.toString(),
                fileIds: [brochure.toString()],
            });

            expect(openedFirst).toEqual([true]);
            expect(result).toMatchObject({floorsCreated: 1, unitsCreated: 1});
            const floor = await Floor.findOne({edifice});
            expect(floor).toMatchObject({name: "Kati 1", levelNumber: 1, area: 90});
            expect(await Unit.findOne({floor: floor!._id})).toMatchObject({name: "A-1", area: 90, verandaArea: 5});
        } finally {
            vi.restoreAllMocks();
        }
    }));
});
