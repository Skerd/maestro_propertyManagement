import {ObjectId} from 'mongodb';
import {action} from '@coreModule/api/actionDecorator';
import {mediaUploadMW} from '@coreModule/utilities/middlewares/mediaUploadMW';
import {apiValidationException} from 'armonia/src/modules/core/helpers/exceptions';
import {mongooseInstance} from '@coreModule/connections/connectToMongoDb';
import {GridFSStorage} from '@coreModule/utilities/gridfs/gridfsStorage';
import {getModelCollectedData} from '@coreModule/database/collections';
import SchemaGuard from '@coreModule/database/security/schemaGuard';
import {mediaService} from '@coreModule/database/schemas/media/media.service';
import {currencyService} from '@coreModule/database/schemas/currency/currency.service';
import {floorService} from '../floor/floor.service';
import {unitService} from '../unit/unit.service';
import {unitTypeService} from '../unitType/unitType.service';
import Edifice from './edifice';
import Floor from '../floor/floor';
import Unit from '../unit/unit';
import {edificeService} from './edifice.service';
import {processPdfForFloorsAndUnits} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/extractPdfPages';
import {computeUnitPriceFromEdificeRates} from '@propertyManagement/utilities/unit/computeUnitPriceFromEdificeRates';
import type {GenerateFloorsAndUnitsFormResponseType} from 'armonia/src/modules/propertyManagement/api/realEstate/private/edifice/generateFloorsAndUnits.form.response.type';
import {slugifyLabel} from '@propertyManagement/utilities/edifice/floorAndUnitsGenerator/utils/fileUtils';
import {PDFDocument} from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {SingleForm} from "armonia/src/modules/core/types/shared.types";
import {validateSingleForm} from "armonia/src/modules/core/utilities/zod/shared.validator";

/** Extract one brochure page (1-indexed) into a standalone PDF buffer. */
async function extractSinglePdfPage(sourcePdf: PDFDocument, pageNumber: number): Promise<Buffer> {
    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
        throw new Error(`PDF page ${pageNumber} is out of range (1-${sourcePdf.getPageCount()})`);
    }
    const pageDoc = await PDFDocument.create();
    const [copiedPage] = await pageDoc.copyPages(sourcePdf, [pageIndex]);
    pageDoc.addPage(copiedPage);
    return Buffer.from(await pageDoc.save());
}

function hasMarketingBooklet(entity: {marketingBooklet?: unknown} | null | undefined): boolean {
    return !!entity?.marketingBooklet;
}

/** Reads a generator artifact, or undefined when that page produced none. */
function readGeneratedFile(filePath: string): Buffer | undefined {
    try {
        return fs.readFileSync(filePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}

/** Reads the numeric level out of a floor label ("Floor -1", "K2", "Kati 0-1"). */
function parseFloorLevelNumber(floorName: string): number {
    const rangeMatch = floorName.match(/(?:floor|kati|kat)\s*(-?\d+-\d+)|^k(-?\d+-\d+)/i);
    if (rangeMatch) {
        const rangeStr = rangeMatch[1] || rangeMatch[2];
        return isNaN(parseInt(rangeStr)) ? -99999 : parseInt(rangeStr);
    }
    const match = floorName.match(/(?:floor|kati|kat)\s*(-?\d+)|^k(-?\d+)/i);
    if (match) {
        const numStr = match[1] || match[2];
        return isNaN(parseInt(numStr)) ? -99999 : parseInt(numStr);
    }
    return 0;
}

/**
 * Never wipe a non-zero existing area (user/manual edit) with a 0 from a
 * re-import when OCR failed to parse that field.
 */
function preferExistingAreaWhenIncomingZero(
    existing: number | null | undefined,
    incoming: number | null | undefined,
): number {
    const prev = typeof existing === 'number' && Number.isFinite(existing) ? existing : 0;
    const next = typeof incoming === 'number' && Number.isFinite(incoming) ? incoming : 0;
    if (prev > 0 && next === 0) {
        return prev;
    }
    return next;
}

/** A file already written to GridFS, waiting for its media document. */
type UploadedBlob = {
    gridFsId: ObjectId;
    fileName: string;
    size: number;
    mediaType: 'image' | 'pdf';
    mimeType: string;
    extension: string;
};

/** One brochure unit's uploaded artifacts. */
type UnitAssets = {
    unitName: string;
    unitSummary: any;
    unitPlan?: UploadedBlob;
    unitFloorPlan?: UploadedBlob;
    booklet?: UploadedBlob;
};

/**
 * The floor document one or more brochure keys resolve to. Two keys can land on
 * the same floor (an unparsed label and "Floor 0" both yield levelNumber 0), so
 * the resolved state — including a booklet added by an earlier key — is shared.
 */
type FloorTarget = {
    existing?: any;
    /** Set once the floor is inserted, so later keys write to the same document. */
    created?: any;
    name: string;
    levelNumber: number;
    hasBooklet: boolean;
    unitsByName: Map<string, any>;
};

/** One brochure floor key with its blobs uploaded, ready to be written. */
type FloorTask = {
    floorKey: string;
    floorData: any;
    floorName: string;
    levelNumber: number;
    floorPlan?: UploadedBlob;
    booklet?: UploadedBlob;
    units: UnitAssets[];
};

/**
 * Maps each brochure floor key onto the floor document it will write to, matching
 * the name-or-level lookup the import used to run per key. Keys that resolve to the
 * same floor share one target, so a booklet or rename applied by an earlier key is
 * visible to a later one — exactly what a per-key query inside the transaction saw.
 */
function resolveFloorTargets(
    existingFloors: any[],
    keys: Array<{floorName: string; levelNumber: number}>,
): {perKey: FloorTarget[]; all: FloorTarget[]} {
    const all: FloorTarget[] = existingFloors.map((floor: any) => ({
        existing:    floor,
        name:        floor.name,
        levelNumber: floor.levelNumber,
        hasBooklet:  hasMarketingBooklet(floor),
        unitsByName: new Map<string, any>(),
    }));

    const perKey = keys.map(({floorName, levelNumber}) => {
        let target = all.find((t) => t.name === floorName || t.levelNumber === levelNumber);
        if (!target) {
            target = {name: floorName, levelNumber, hasBooklet: false, unitsByName: new Map<string, any>()};
            all.push(target);
        }
        target.name        = floorName;
        target.levelNumber = levelNumber;
        return target;
    });

    return {perKey, all};
}

export class EdificeActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 10},
        middleware: [
            mediaUploadMW({fieldName: "file", maxFiles: 1, maxFileSize: 50 * 1024 * 1024}),
        ],
        schema: validateSingleForm,
    })
    async generateFloorsUnits(params: SingleForm & Record<string, any>): Promise<GenerateFloorsAndUnitsFormResponseType> {
        const {logger, languageCode, session, _id, company, actionUserCtx, fileIds} = params;

        const edificeId = _id;
        logger.start(`Generating floors and units from PDF brochure for edifice: ${edificeId}...`);

        const {writeFields} = getModelCollectedData("edifices");
        const edificeWriteFields = SchemaGuard.sanitizeFields(Edifice, writeFields!, "write", actionUserCtx, languageCode);
        if (!edificeWriteFields || Object.keys(edificeWriteFields).length === 0) {
            throw apiValidationException("insufficient_permissions", "", null, languageCode);
        }

        SchemaGuard.checkModelPermission(Floor, "create", actionUserCtx, languageCode);
        SchemaGuard.checkModelPermission(Unit, "create", actionUserCtx, languageCode);

        const foundEdifice = await edificeService.findOneOrThrow(
            {_id: new ObjectId(edificeId), company: company._id},
            {session, logger, languageCode},
        );

        // Sale pricing configured on the edifice — used to compute each generated unit's price:
        // price = pricePerMeterSquared * totalArea + verandaPricePerMeterSquared * verandaArea, in saleCurrency.
        const pricePerM2 = typeof foundEdifice.pricePerMeterSquared === "number" ? foundEdifice.pricePerMeterSquared : null;
        const verandaPricePerM2 = typeof foundEdifice.verandaPricePerMeterSquared === "number" ? foundEdifice.verandaPricePerMeterSquared : null;
        const saleCurrencyId = foundEdifice.saleCurrency
            ? ((foundEdifice.saleCurrency as any)._id ?? foundEdifice.saleCurrency)
            : null;

        const fileId = Array.isArray(fileIds) ? fileIds[0] : fileIds;
        if (!fileId) {
            throw apiValidationException("file_required", "", null, languageCode);
        }

        const mediaDoc = await mediaService.findByIdOrThrow(new ObjectId(fileId), {session, logger, languageCode});

        const tempDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-processing-'));
        const pdfPath    = path.join(tempDir, 'brochure.pdf');
        const outputRoot = path.join(tempDir, 'output');

        let floorsCreated = 0;
        let unitsCreated  = 0;
        let unitsSkipped  = 0;

        // GridFS writes cannot join a Mongo transaction, so every blob is uploaded up
        // front and tracked here. If the import fails these are deleted; if it succeeds,
        // any blob no document ended up referencing is swept. Either way nothing leaks.
        const uploadedGridFsIds: ObjectId[] = [];
        const referencedGridFsIds = new Set<string>();
        let committed = false;

        const gridfsStorage = new GridFSStorage(languageCode, 'media', logger);

        const deleteGridFsBlobs = async (ids: ObjectId[], reason: string): Promise<void> => {
            if (ids.length === 0) return;
            const results = await Promise.allSettled(ids.map((id) => gridfsStorage.deleteFile(id)));
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0) {
                logger.warn(`PDF import: ${failed}/${ids.length} GridFS blobs could not be removed (${reason}) edificeId=${edificeId}`);
            } else {
                logger.debug(`PDF import: removed ${ids.length} GridFS blobs (${reason}) edificeId=${edificeId}`);
            }
        };

        try {
            const rawPdfFileId = mediaDoc.fileId;
            if (rawPdfFileId == null) {
                logger.err(`PDF import: media missing fileId mediaId=${mediaDoc._id} edificeId=${edificeId}`);
                throw apiValidationException("pdf_processing_failed", "media_missing_file_id", null, languageCode);
            }
            // Passed as hex: mongoose's ObjectId and the driver's come from different
            // bson copies, so handing the document's instance straight to GridFS both
            // fails to typecheck and risks a cross-version mismatch. getFileBuffer
            // rebuilds the id with the bucket's own ObjectId class.
            const pdfBuffer = await gridfsStorage.getFileBuffer(rawPdfFileId.toString());

            fs.writeFileSync(pdfPath, pdfBuffer);

            // ── Phase 1: reads ──────────────────────────────────────────────────────
            // Resolved before the generator runs, so the missing-master fallback below
            // can consult existing floors, and before the transaction opens so that the
            // transaction is writes only.

            const defaultUnitTypes = await unitTypeService.find({company: company._id}, {session, logger, languageCode}, undefined, "_id", {}, 1, 0);
            const unitTypeId = defaultUnitTypes.length > 0 ? defaultUnitTypes[0]._id : null;
            if (!unitTypeId) {
                logger.warn(`PDF import: no unit type found for company, skipping all units edificeId=${edificeId}`);
            }

            const defaultCurrencies = await currencyService.find({}, {session, logger, languageCode}, undefined, "_id", {}, 1, 0);
            const currencyId = defaultCurrencies.length > 0 ? defaultCurrencies[0]._id : null;
            if (!currencyId) {
                logger.warn(`PDF import: no currency found, skipping all units edificeId=${edificeId}`);
            }

            const knownFloors: any[] = await floorService.find(
                {edifice: foundEdifice._id, company: company._id},
                {session, logger, languageCode},
            );

            /**
             * Master plan of last resort. Some brochures ship unit pages for a floor but
             * no master page for it (ARIA_GODINA_A has units for KATI 2 and masters only
             * up to KATI 1), and without a master the unit highlights cannot be aligned,
             * so those units silently get no polygons. If the floor already exists with a
             * mainImage, reuse it: polygons are stored as fractions of the master, and
             * that image is what the floor renders with, so the two stay consistent.
             */
            const fetchFloorImage = async ({floorLabel}: {floorLabel: string}): Promise<string | null> => {
                try {
                    const levelNumber = parseFloorLevelNumber(floorLabel);
                    const floor = knownFloors.find(
                        (candidate: any) => candidate.name === floorLabel || candidate.levelNumber === levelNumber,
                    );
                    if (!floor?.mainImage) return null;

                    const mainImageId = (floor.mainImage as any)?._id ?? floor.mainImage;
                    const media = await mediaService.findById(mainImageId, {session, logger, languageCode});
                    if (!media?.fileId) {
                        logger.warn(`PDF import: floor ${floorLabel} mainImage has no GridFS file edificeId=${edificeId}`);
                        return null;
                    }

                    const buffer = await gridfsStorage.getFileBuffer(media.fileId.toString());
                    const target = path.join(tempDir, `db-floor-plan-${slugifyLabel(floorLabel)}.png`);
                    fs.writeFileSync(target, buffer);
                    logger.debug(`PDF import: no master page for ${floorLabel}; reusing the existing floor mainImage edificeId=${edificeId}`);
                    return target;
                } catch (error) {
                    logger.warn(`PDF import: could not reuse the existing floor image for ${floorLabel} edificeId=${edificeId}: ${error instanceof Error ? error.message : String(error)}`);
                    return null;
                }
            };

            const summaryData  = await processPdfForFloorsAndUnits(pdfPath, outputRoot, {fetchFloorImage});
            const sourcePdfDoc = await PDFDocument.load(pdfBuffer);

            const tasks: FloorTask[] = Object.entries(summaryData.floors).map(([floorKey, floorData]) => ({
                floorKey,
                floorData,
                floorName:   (floorData as any).floor,
                levelNumber: parseFloorLevelNumber((floorData as any).floor),
                units:       [],
            }));

            // Resolution used only to decide which booklets are worth uploading; the
            // write phase resolves again against its own reads.
            const planned = resolveFloorTargets(knownFloors, tasks);

            // One read per existing floor, rather than a findOne per unit.
            for (const target of planned.all) {
                if (!target.existing) continue;
                const existingUnits: any[] = await unitService.find(
                    {floor: target.existing._id, company: company._id},
                    {session, logger, languageCode},
                );
                target.unitsByName = new Map(existingUnits.map((unit: any) => [unit.name, unit]));
            }

            // ── Phase 2: uploads ────────────────────────────────────────────────────
            // All GridFS I/O and PDF page extraction, outside the transaction.

            const uploadBlob = async (
                buffer: Buffer,
                fileName: string,
                meta: Record<string, string>,
                kind: 'image' | 'pdf',
            ): Promise<UploadedBlob> => {
                const gridFsId = await gridfsStorage.uploadFile(buffer, fileName, meta);
                uploadedGridFsIds.push(gridFsId);
                return {
                    gridFsId,
                    fileName,
                    size:      buffer.length,
                    mediaType: kind,
                    mimeType:  kind === 'image' ? 'image/png' : 'application/pdf',
                    extension: kind === 'image' ? 'png' : 'pdf',
                };
            };

            const uploadBrochurePage = async (
                pageNumber: number,
                fileName: string,
                meta: Record<string, string>,
                describeTarget: string,
            ): Promise<UploadedBlob | undefined> => {
                try {
                    const pageBuffer = await extractSinglePdfPage(sourcePdfDoc, pageNumber);
                    return await uploadBlob(pageBuffer, fileName, meta, 'pdf');
                } catch (bookletErr) {
                    logger.warn(`PDF import: failed to extract booklet page edificeId=${edificeId} ${describeTarget} page=${pageNumber} error=${bookletErr instanceof Error ? bookletErr.message : String(bookletErr)}`);
                    return undefined;
                }
            };

            for (const [taskIndex, task] of tasks.entries()) {
                const {floorKey, floorData} = task;
                const target = planned.perKey[taskIndex];

                const floorPlanBuffer = readGeneratedFile(path.join(outputRoot, "floors", floorKey, 'floor-plan.png'));
                if (floorPlanBuffer) {
                    task.floorPlan = await uploadBlob(
                        floorPlanBuffer,
                        `floor-plan-${floorKey}.png`,
                        {edifice: edificeId, floor: floorKey, type: 'floorPlan'},
                        'image',
                    );
                }

                // Single-page PDF from the brochure, used when marketingBooklet is unset.
                if (!target.hasBooklet && typeof floorData.pageNumber === 'number') {
                    task.booklet = await uploadBrochurePage(
                        floorData.pageNumber,
                        `floor-booklet-${floorKey}-page-${floorData.pageNumber}.pdf`,
                        {edifice: edificeId, floor: floorKey, type: 'marketingBooklet'},
                        `floor=${floorKey}`,
                    );
                    if (task.booklet) target.hasBooklet = true;
                }

                for (const [unitName, unitSummaries] of Object.entries(floorData.units)) {
                    const unitSummary = (unitSummaries as any[])[0];

                    if (!unitTypeId) {
                        logger.warn(`PDF import: skipping unit (no unit type) edificeId=${edificeId} floorKey=${floorKey} unit=${unitName}`);
                        unitsSkipped++;
                        continue;
                    }
                    if (!currencyId) {
                        logger.warn(`PDF import: skipping unit (no currency) edificeId=${edificeId} floorKey=${floorKey} unit=${unitName}`);
                        unitsSkipped++;
                        continue;
                    }

                    const assets: UnitAssets = {unitName, unitSummary};
                    const unitFolder = path.join(outputRoot, "floors", floorKey, "units", slugifyLabel(unitName));
                    const existingUnitForUpload = target.unitsByName.get(unitName);

                    // Center crop is only stored on create (as the first gallery image).
                    // Re-uploading it on regen used to append a duplicate to every unit.
                    const unitPlanBuffer = !existingUnitForUpload
                        ? readGeneratedFile(path.join(unitFolder, 'unit-plan.png'))
                        : undefined;
                    if (unitPlanBuffer) {
                        assets.unitPlan = await uploadBlob(
                            unitPlanBuffer,
                            `unit-plan-${unitName}-${floorKey}.png`,
                            {edifice: edificeId, floor: floorKey, unit: unitName, type: 'unitPlan'},
                            'image',
                        );
                    }

                    const unitFloorPlanBuffer = readGeneratedFile(path.join(unitFolder, 'floor-plan.png'));
                    if (unitFloorPlanBuffer) {
                        assets.unitFloorPlan = await uploadBlob(
                            unitFloorPlanBuffer,
                            `floor-plan-${unitName}-${floorKey}.png`,
                            {edifice: edificeId, floor: floorKey, unit: unitName, type: 'unitFloorPlan'},
                            'image',
                        );
                    }

                    if (!hasMarketingBooklet(target.unitsByName.get(unitName)) && typeof unitSummary.pageNumber === 'number') {
                        assets.booklet = await uploadBrochurePage(
                            unitSummary.pageNumber,
                            `unit-booklet-${slugifyLabel(unitName)}-${floorKey}-page-${unitSummary.pageNumber}.pdf`,
                            {edifice: edificeId, floor: floorKey, unit: unitName, type: 'marketingBooklet'},
                            `unit=${unitName}`,
                        );
                    }

                    task.units.push(assets);
                }
            }

            logger.debug(`PDF import: uploaded ${uploadedGridFsIds.length} blobs for ${tasks.length} floors edificeId=${edificeId}`);

            // ── Phase 3: document writes ────────────────────────────────────────────
            // Short transaction: no file I/O, no PDF work, no reads.

            const floorImportSession = await mongooseInstance.startSession();
            try {
                await floorImportSession.withTransaction(async () => {
                    const txSession = floorImportSession;

                    // withTransaction re-runs this callback on transient errors, so every
                    // attempt must start from scratch: counters reset, and floors/units
                    // re-read rather than reusing documents an aborted attempt mutated
                    // (whose inserts have since been rolled away).
                    floorsCreated = 0;
                    unitsCreated  = 0;
                    referencedGridFsIds.clear();

                    const txFloors: any[] = await floorService.find(
                        {edifice: foundEdifice._id, company: company._id},
                        {session: txSession, logger, languageCode},
                    );
                    const resolved = resolveFloorTargets(txFloors, tasks);
                    for (const target of resolved.all) {
                        if (!target.existing) continue;
                        const existingUnits: any[] = await unitService.find(
                            {floor: target.existing._id, company: company._id},
                            {session: txSession, logger, languageCode},
                        );
                        target.unitsByName = new Map(existingUnits.map((unit: any) => [unit.name, unit]));
                    }

                    const createMediaDoc = (blob: UploadedBlob) => {
                        referencedGridFsIds.add(blob.gridFsId.toString());
                        return mediaService.create({
                            type:         blob.mediaType,
                            originalName: blob.fileName,
                            fileName:     blob.fileName,
                            fileId:       blob.gridFsId,
                            createdBy:    actionUserCtx.userId,
                            metadata:     {size: blob.size, extension: blob.extension, mime: blob.mimeType, safeCheckedFlag: false},
                            mimeType:     blob.mimeType,
                            extension:    blob.extension,
                            fileSize:     blob.size,
                            sizeInBytes:  blob.size,
                            company,
                        } as any, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                    };

                    for (const [taskIndex, task] of tasks.entries()) {
                        const {floorData, floorName, levelNumber} = task;
                        const target = resolved.perKey[taskIndex];

                        const floorPlanMedia = task.floorPlan ? await createMediaDoc(task.floorPlan) : undefined;

                        const floorDoc = target.created ?? target.existing;
                        let createdFloor;
                        const isNewFloor = !floorDoc;

                        // Re-checked against the document this attempt actually read: the
                        // upload phase only guessed, and a floor that already has a booklet
                        // must keep it. An unused blob is swept after the commit.
                        const floorBookletMedia = task.booklet && !hasMarketingBooklet(floorDoc)
                            ? await createMediaDoc(task.booklet)
                            : undefined;

                        if (floorDoc) {
                            floorDoc.name        = floorName;
                            floorDoc.levelNumber = levelNumber;
                            floorDoc.totalUnits  = Object.keys(floorData.units).length;

                            if (floorPlanMedia)    floorDoc.mainImage        = floorPlanMedia;
                            if (floorBookletMedia) floorDoc.marketingBooklet = floorBookletMedia;

                            floorDoc.$locals = floorDoc.$locals || {};
                            floorDoc.$locals.auditUserId = new ObjectId(actionUserCtx.userId);

                            // Saved once, after the unit loop has computed `area`.
                            createdFloor = floorDoc;
                        } else {
                            const floorDataToCreate: any = {
                                name:              floorName,
                                levelNumber,
                                edifice:           foundEdifice._id,
                                project:           foundEdifice.project._id,
                                company:           company._id,
                                isAccessible:      true,
                                hasEmergencyExit:  false,
                                totalUnits:        Object.keys(floorData.units).length,
                                area:              0,
                                imageGallery:      [],
                                videoGallery:      [],
                            };
                            if (floorPlanMedia)    floorDataToCreate.mainImage        = floorPlanMedia;
                            if (floorBookletMedia) floorDataToCreate.marketingBooklet = floorBookletMedia;

                            createdFloor = await floorService.create(floorDataToCreate, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                            floorsCreated++;
                            target.created = createdFloor;
                        }

                        let floorTotalArea = 0;
                        for (const assets of task.units) {
                            const {unitName, unitSummary} = assets;

                            const unitFloorPlanMedia = assets.unitFloorPlan ? await createMediaDoc(assets.unitFloorPlan) : undefined;

                            // Keep the full unit name as the unit number so every unit is unique.
                            // The old regex only captured the trailing digits (e.g. "13" for both
                            // "A-13" and "B-13"), which caused same-floor collisions — the second
                            // unit matched the first via {unitNumber} and was "updated" instead of created.
                            const unitNumber = unitName;

                            const existingUnit = target.unitsByName.get(unitName);

                            if (existingUnit) {
                                existingUnit.unitNumber = unitNumber;

                                // Keep non-zero existing areas when OCR returns 0 for that field.
                                const incomingTotal =
                                    (unitSummary.totalArea || 0) > 0
                                        ? unitSummary.totalArea
                                        : (unitSummary.netArea || 0) + (unitSummary.sharedArea || 0);

                                existingUnit.netArea = preferExistingAreaWhenIncomingZero(existingUnit.netArea, unitSummary.netArea);
                                existingUnit.sharedArea = preferExistingAreaWhenIncomingZero(existingUnit.sharedArea, unitSummary.sharedArea);
                                existingUnit.area = preferExistingAreaWhenIncomingZero(existingUnit.area, incomingTotal);
                                existingUnit.verandaArea = preferExistingAreaWhenIncomingZero(existingUnit.verandaArea, unitSummary.verandaArea);
                                existingUnit.polygonCoordinates = unitSummary.polygonCoordinates || existingUnit.polygonCoordinates || [];

                                // Only recompute for units that still follow edifice rates.
                                // Missing flag (legacy) is treated as manual — same as migration default.
                                if (existingUnit.priceManuallyEdited === false) {
                                    const recomputed = computeUnitPriceFromEdificeRates({
                                        pricePerMeterSquared: pricePerM2,
                                        verandaPricePerMeterSquared: verandaPricePerM2,
                                        area: existingUnit.area,
                                        verandaArea: existingUnit.verandaArea,
                                    });
                                    if (recomputed != null) {
                                        existingUnit.price = recomputed as any;
                                        if (saleCurrencyId) existingUnit.priceCurrency = saleCurrencyId;
                                        existingUnit.priceManuallyEdited = false;
                                    }
                                }

                                if (unitFloorPlanMedia) {
                                    existingUnit.mainImage = unitFloorPlanMedia;
                                }

                                if (assets.booklet && !hasMarketingBooklet(existingUnit)) {
                                    existingUnit.marketingBooklet = await createMediaDoc(assets.booklet);
                                }

                                existingUnit.$locals = existingUnit.$locals || {};
                                existingUnit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);

                                await existingUnit.save({session: txSession});
                                floorTotalArea += existingUnit.area;
                            } else {
                                const unitPlanMedia = assets.unitPlan ? await createMediaDoc(assets.unitPlan) : undefined;
                                const imageGallery: any[] = [];
                                if (unitPlanMedia) imageGallery.push(unitPlanMedia);

                                const unitArea = unitSummary.totalArea || unitSummary.netArea + unitSummary.sharedArea || 0;
                                const unitVerandaArea = unitSummary.verandaArea || 0;
                                const computedPrice = computeUnitPriceFromEdificeRates({
                                    pricePerMeterSquared: pricePerM2,
                                    verandaPricePerMeterSquared: verandaPricePerM2,
                                    area: unitArea,
                                    verandaArea: unitVerandaArea,
                                }) ?? 0;

                                const unitBookletMedia = assets.booklet ? await createMediaDoc(assets.booklet) : undefined;

                                const unitDataToCreate: any = {
                                    name:               unitName,
                                    unitNumber,
                                    edifice:            foundEdifice._id,
                                    floor:              createdFloor._id,
                                    project:            foundEdifice.project._id,
                                    company:            company._id,
                                    unitType:           unitTypeId,
                                    netArea:            unitSummary.netArea || 0,
                                    sharedArea:         unitSummary.sharedArea || 0,
                                    area:               unitArea,
                                    verandaArea:        unitVerandaArea,
                                    polygonCoordinates: unitSummary.polygonCoordinates || [],
                                    price:              computedPrice,
                                    priceCurrency:      saleCurrencyId ?? currencyId,
                                    priceManuallyEdited: false,
                                    hasBalcony:         false,
                                    hasTerrace:         false,
                                    hasSeaView:         false,
                                    hasCityView:        false,
                                    hasLakeView:        false,
                                    hasElevator:        false,
                                    numberOfRooms:      0,
                                    numberOfBathrooms:  0,
                                    imageGallery,
                                    videoGallery:       [],
                                    connectedUnits:     [],
                                };
                                if (unitFloorPlanMedia) unitDataToCreate.mainImage = unitFloorPlanMedia;
                                if (unitBookletMedia)   unitDataToCreate.marketingBooklet = unitBookletMedia;

                                const newUnit = await unitService.create(unitDataToCreate, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                                unitsCreated++;
                                target.unitsByName.set(unitName, newUnit);
                                floorTotalArea += unitDataToCreate.area;
                            }
                        }

                        if (floorTotalArea > 0) {
                            createdFloor.area = floorTotalArea;
                        }
                        // A new floor was already persisted by create(); it only needs a second
                        // write when the unit loop produced an area. An existing floor carries
                        // this iteration's edits and is written exactly once, here.
                        if (!isNewFloor || floorTotalArea > 0) {
                            await createdFloor.save({session: txSession});
                        }
                    }
                });
                committed = true;
            } finally {
                await floorImportSession.endSession();
            }

            // Blobs whose media document was never written (e.g. a booklet the target
            // turned out to already have) would otherwise sit in GridFS unreferenced.
            try {
                const unreferenced = uploadedGridFsIds.filter((id) => !referencedGridFsIds.has(id.toString()));
                await deleteGridFsBlobs(unreferenced, 'unreferenced after import');
            } catch (sweepError) {
                logger.warn(`PDF import: unreferenced-blob sweep failed edificeId=${edificeId}`, sweepError);
            }

            const floorsUpdated = Object.keys(summaryData.floors).length - floorsCreated;
            const unitsTotal    = Object.values(summaryData.floors).reduce((t, f: any) => t + Object.keys(f.units).length, 0);
            // Units skipped for a missing unit type / currency were neither created nor
            // updated — counting them as updated claimed work that never happened.
            const unitsUpdated  = unitsTotal - unitsCreated - unitsSkipped;

            const summaryMessage = `Successfully processed PDF: ${floorsCreated} floors created, ${floorsUpdated} floors updated, ${unitsCreated} units created, ${unitsUpdated} units updated`
                + (unitsSkipped > 0 ? `, ${unitsSkipped} units skipped` : '');

            logger.finish(summaryMessage);
            return {
                message: summaryMessage,
                floorsCreated,
                unitsCreated,
            };
        } catch (error) {
            // Nothing committed, so every blob uploaded above is unreachable.
            if (!committed) {
                try {
                    await deleteGridFsBlobs(uploadedGridFsIds, 'import failed');
                } catch (cleanupError) {
                    logger.warn("Failed to clean up uploaded GridFS blobs", cleanupError);
                }
            }
            const errMsg   = error instanceof Error ? error.message : String(error);
            const errStack = error instanceof Error ? error.stack   : undefined;
            logger.err(`PDF floor/unit import failed edificeId=${edificeId} error=${errMsg}${errStack ? ` stack=${errStack}` : ""}`, error);
            throw apiValidationException("pdf_processing_failed", error instanceof Error ? error.message : String(error), null, languageCode);
        } finally {
            try {
                if (fs.existsSync(tempDir)) fs.rmSync(tempDir, {recursive: true, force: true});
            } catch (cleanupError) {
                logger.warn("Failed to clean up temporary files", cleanupError);
            }
        }
    }
}
