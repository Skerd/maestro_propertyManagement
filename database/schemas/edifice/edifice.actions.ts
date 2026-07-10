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

        try {
            const gridfs        = new GridFSStorage(languageCode, 'media', logger);
            const rawPdfFileId  = mediaDoc.fileId;
            if (rawPdfFileId == null) {
                logger.err(`PDF import: media missing fileId mediaId=${mediaDoc._id} edificeId=${edificeId}`);
                throw apiValidationException("pdf_processing_failed", "media_missing_file_id", null, languageCode);
            }
            const gridfsFileId = rawPdfFileId instanceof ObjectId ? rawPdfFileId : new ObjectId(rawPdfFileId.toString());
            const pdfBuffer    = await gridfs.getFileBuffer(gridfsFileId);

            fs.writeFileSync(pdfPath, pdfBuffer);

            const summaryData = await processPdfForFloorsAndUnits(pdfPath, outputRoot);
            const gridfsStorage  = new GridFSStorage(languageCode, 'media', logger);
            const sourcePdfDoc   = await PDFDocument.load(pdfBuffer);

            const createPdfPageMedia = async (
                pageNumber: number,
                fileName: string,
                meta: Record<string, string>,
                txSession: any,
            ) => {
                const pageBuffer = await extractSinglePdfPage(sourcePdfDoc, pageNumber);
                const gfsId = await gridfsStorage.uploadFile(pageBuffer, fileName, meta);
                return mediaService.create({
                    type:         'pdf',
                    originalName: fileName,
                    fileName,
                    fileId:       gfsId,
                    createdBy:    actionUserCtx.userId,
                    metadata:     {size: pageBuffer.length, extension: 'pdf', mime: 'application/pdf', safeCheckedFlag: false},
                    mimeType:     'application/pdf',
                    extension:    'pdf',
                    fileSize:     pageBuffer.length,
                    sizeInBytes:  pageBuffer.length,
                    company,
                }, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
            };

            const floorImportSession = await mongooseInstance.startSession();
            try {
                await floorImportSession.withTransaction(async () => {
                    const txSession = floorImportSession;

                    const defaultUnitTypes = await unitTypeService.find({company: company._id}, {session: txSession, logger, languageCode}, undefined, "_id", {}, 1, 0);
                    const unitTypeId = defaultUnitTypes.length > 0 ? defaultUnitTypes[0]._id : null;
                    if (!unitTypeId) {
                        logger.warn(`PDF import: no unit type found for company, skipping all units edificeId=${edificeId}`);
                    }

                    const defaultCurrencies = await currencyService.find({}, {session: txSession, logger, languageCode}, undefined, "_id", {}, 1, 0);
                    const currencyId = defaultCurrencies.length > 0 ? defaultCurrencies[0]._id : null;
                    if (!currencyId) {
                        logger.warn(`PDF import: no currency found, skipping all units edificeId=${edificeId}`);
                    }

                    for (const [floorKey, floorData] of Object.entries(summaryData.floors)) {
                        const floorName = floorData.floor;

                        let levelNumber = 0;
                        const rangeMatch = floorName.match(/(?:floor|kati|kat)\s*(-?\d+-\d+)|^k(-?\d+-\d+)/i);
                        if (rangeMatch) {
                            const rangeStr = rangeMatch[1] || rangeMatch[2];
                            levelNumber = isNaN(parseInt(rangeStr)) ? -99999 : parseInt(rangeStr);
                        } else {
                            const match = floorName.match(/(?:floor|kati|kat)\s*(-?\d+)|^k(-?\d+)/i);
                            if (match) {
                                const numStr = match[1] || match[2];
                                levelNumber = isNaN(parseInt(numStr)) ? -99999 : parseInt(numStr);
                            }
                        }

                        let floorPlanImageId: ObjectId | undefined;
                        const floorPlanPath = path.join(outputRoot, "floors", floorKey, 'floor-plan.png');
                        let floorPlanBuffer: Buffer | undefined;
                        let floorPlanFileName = "";

                        if (fs.existsSync(floorPlanPath)) {
                            floorPlanBuffer   = fs.readFileSync(floorPlanPath);
                            floorPlanFileName = `floor-plan-${floorKey}.png`;
                        }

                        let existingFloor = await floorService.findOne(
                            {
                                edifice: foundEdifice._id,
                                company: company._id,
                                $or: [{name: floorName}, {levelNumber: levelNumber}],
                            },
                            {session: txSession, logger, languageCode},
                        );

                        if (floorPlanBuffer) {
                            const gridfsFileId = await gridfsStorage.uploadFile(
                                floorPlanBuffer,
                                floorPlanFileName,
                                {edifice: edificeId, floor: floorKey, type: 'floorPlan'},
                            );

                            const mediaData: any = {
                                type:         'image',
                                originalName: floorPlanFileName,
                                fileName:     floorPlanFileName,
                                fileId:       gridfsFileId,
                                createdBy:    actionUserCtx.userId,
                                metadata:     {size: floorPlanBuffer.length, extension: 'png', mime: 'image/png', safeCheckedFlag: false},
                                mimeType:     'image/png',
                                extension:    'png',
                                fileSize:     floorPlanBuffer.length,
                                sizeInBytes:  floorPlanBuffer.length,
                                company:      company,
                            };

                            const media     = await mediaService.create(mediaData, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                            floorPlanImageId = media._id;
                        }

                        // Single-page PDF from the brochure, used when marketingBooklet is unset.
                        let floorBookletMedia: any = undefined;
                        const shouldSetFloorBooklet = !hasMarketingBooklet(existingFloor) && typeof floorData.pageNumber === 'number';
                        if (shouldSetFloorBooklet) {
                            try {
                                floorBookletMedia = await createPdfPageMedia(
                                    floorData.pageNumber!,
                                    `floor-booklet-${floorKey}-page-${floorData.pageNumber}.pdf`,
                                    {edifice: edificeId, floor: floorKey, type: 'marketingBooklet'},
                                    txSession,
                                );
                            } catch (bookletErr) {
                                logger.warn(`PDF import: failed to extract floor booklet page edificeId=${edificeId} floor=${floorKey} page=${floorData.pageNumber} error=${bookletErr instanceof Error ? bookletErr.message : String(bookletErr)}`);
                            }
                        }

                        let createdFloor;
                        if (existingFloor) {
                            existingFloor.name        = floorName;
                            existingFloor.levelNumber = levelNumber;
                            existingFloor.totalUnits  = Object.keys(floorData.units).length;

                            if (floorPlanImageId) {
                                const newMedia = await mediaService.findByIdOrThrow(floorPlanImageId, {session: txSession, logger, languageCode});
                                existingFloor.mainImage = newMedia;
                            }
                            if (floorBookletMedia) {
                                existingFloor.marketingBooklet = floorBookletMedia;
                            }

                            existingFloor.$locals = existingFloor.$locals || {};
                            existingFloor.$locals.auditUserId = new ObjectId(actionUserCtx.userId);

                            await existingFloor.save({session: txSession});
                            createdFloor = existingFloor;
                        } else {
                            let mainImageMedia: any = undefined;
                            if (floorPlanImageId) {
                                mainImageMedia = await mediaService.findByIdOrThrow(floorPlanImageId, {session: txSession, logger, languageCode});
                            }

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
                            if (mainImageMedia) floorDataToCreate.mainImage = mainImageMedia;
                            if (floorBookletMedia) floorDataToCreate.marketingBooklet = floorBookletMedia;

                            createdFloor = await floorService.create(floorDataToCreate, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                            floorsCreated++;
                        }

                        let floorTotalArea = 0;
                        for (const [unitName, unitSummaries] of Object.entries(floorData.units)) {
                            const unitSummary = unitSummaries[0];

                            if (!unitTypeId) {
                                logger.warn(`PDF import: skipping unit (no unit type) edificeId=${edificeId} floorKey=${floorKey} unit=${unitName}`);
                                continue;
                            }
                            if (!currencyId) {
                                logger.warn(`PDF import: skipping unit (no currency) edificeId=${edificeId} floorKey=${floorKey} unit=${unitName}`);
                                continue;
                            }

                            let unitPlanImageId: ObjectId | undefined;
                            let unitFloorPlanImageId: ObjectId | undefined;
                            const unitFolder = path.join(outputRoot, "floors", floorKey, "units", slugifyLabel(unitName));

                            const unitPlanPath = path.join(unitFolder, 'unit-plan.png');
                            if (fs.existsSync(unitPlanPath)) {
                                const unitPlanBuffer = fs.readFileSync(unitPlanPath);
                                const gfsId = await gridfsStorage.uploadFile(unitPlanBuffer, `unit-plan-${unitName}-${floorKey}.png`, {edifice: edificeId, floor: floorKey, unit: unitName, type: 'unitPlan'});
                                const mediaData: any = {type: 'image', originalName: `unit-plan-${unitName}-${floorKey}.png`, fileName: `unit-plan-${unitName}-${floorKey}.png`, fileId: gfsId, createdBy: actionUserCtx.userId, metadata: {size: unitPlanBuffer.length, extension: 'png', mime: 'image/png', safeCheckedFlag: false}, mimeType: 'image/png', extension: 'png', fileSize: unitPlanBuffer.length, sizeInBytes: unitPlanBuffer.length, company: company};
                                const media = await mediaService.create(mediaData, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                                unitPlanImageId = media._id;
                            }

                            const unitFloorPlanPath = path.join(unitFolder, 'floor-plan.png');
                            if (fs.existsSync(unitFloorPlanPath)) {
                                const unitFloorPlanBuffer = fs.readFileSync(unitFloorPlanPath);
                                const gfsId = await gridfsStorage.uploadFile(unitFloorPlanBuffer, `floor-plan-${unitName}-${floorKey}.png`, {edifice: edificeId, floor: floorKey, unit: unitName, type: 'unitFloorPlan'});
                                const mediaData: any = {type: 'image', originalName: `floor-plan-${unitName}-${floorKey}.png`, fileName: `floor-plan-${unitName}-${floorKey}.png`, fileId: gfsId, createdBy: actionUserCtx.userId, metadata: {size: unitFloorPlanBuffer.length, extension: 'png', mime: 'image/png', safeCheckedFlag: false}, mimeType: 'image/png', extension: 'png', fileSize: unitFloorPlanBuffer.length, sizeInBytes: unitFloorPlanBuffer.length, company: company};
                                const media = await mediaService.create(mediaData, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                                unitFloorPlanImageId = media._id;
                            }

                            // Keep the full unit name as the unit number so every unit is unique.
                            // The old regex only captured the trailing digits (e.g. "13" for both
                            // "A-13" and "B-13"), which caused same-floor collisions — the second
                            // unit matched the first via {unitNumber} and was "updated" instead of created.
                            const unitNumber = unitName;

                            let existingUnit = await unitService.findOne(
                                {floor: createdFloor._id, company: company._id, name: unitName},
                                {session: txSession, logger, languageCode},
                            );

                            if (existingUnit) {
                                existingUnit.name      = unitName;
                                existingUnit.unitNumber = unitNumber;
                                existingUnit.netArea    = unitSummary.netArea || existingUnit.netArea || 0;
                                existingUnit.sharedArea = unitSummary.sharedArea || existingUnit.sharedArea || 0;
                                existingUnit.area       = unitSummary.totalArea || unitSummary.netArea + unitSummary.sharedArea || existingUnit.area || 0;
                                existingUnit.verandaArea = unitSummary.verandaArea || existingUnit.verandaArea || 0;
                                existingUnit.polygonCoordinates = unitSummary.polygonCoordinates || existingUnit.polygonCoordinates || [];

                                // Recompute sale price from the edifice pricing config when available.
                                if (pricePerM2 != null) {
                                    existingUnit.price = (pricePerM2 * existingUnit.area
                                        + (verandaPricePerM2 != null ? verandaPricePerM2 * (existingUnit.verandaArea || 0) : 0)) as any;
                                    if (saleCurrencyId) existingUnit.priceCurrency = saleCurrencyId;
                                }

                                if (unitFloorPlanImageId) {
                                    existingUnit.mainImage = await mediaService.findByIdOrThrow(unitFloorPlanImageId, {session: txSession, logger, languageCode});
                                }
                                if (unitPlanImageId) {
                                    const unitPlanMedia    = await mediaService.findByIdOrThrow(unitPlanImageId, {session: txSession, logger, languageCode});
                                    const currentGallery   = existingUnit.imageGallery || [];
                                    const alreadyInGallery = currentGallery.some((img: any) => {
                                        const imgId = img instanceof ObjectId ? img : img._id || img;
                                        return imgId.toString() === unitPlanImageId!.toString();
                                    });
                                    if (!alreadyInGallery) existingUnit.imageGallery = [...currentGallery, unitPlanMedia];
                                }

                                if (!hasMarketingBooklet(existingUnit) && typeof unitSummary.pageNumber === 'number') {
                                    try {
                                        existingUnit.marketingBooklet = await createPdfPageMedia(
                                            unitSummary.pageNumber,
                                            `unit-booklet-${slugifyLabel(unitName)}-${floorKey}-page-${unitSummary.pageNumber}.pdf`,
                                            {edifice: edificeId, floor: floorKey, unit: unitName, type: 'marketingBooklet'},
                                            txSession,
                                        );
                                    } catch (bookletErr) {
                                        logger.warn(`PDF import: failed to extract unit booklet page edificeId=${edificeId} unit=${unitName} page=${unitSummary.pageNumber} error=${bookletErr instanceof Error ? bookletErr.message : String(bookletErr)}`);
                                    }
                                }

                                existingUnit.$locals = existingUnit.$locals || {};
                                existingUnit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);

                                await existingUnit.save({session: txSession});
                                floorTotalArea += existingUnit.area;
                            } else {
                                let mainImageMedia: any = undefined;
                                const imageGallery: any[] = [];

                                if (unitFloorPlanImageId) mainImageMedia = await mediaService.findByIdOrThrow(unitFloorPlanImageId, {session: txSession, logger, languageCode});
                                if (unitPlanImageId)      imageGallery.push(await mediaService.findByIdOrThrow(unitPlanImageId, {session: txSession, logger, languageCode}));

                                const unitArea = unitSummary.totalArea || unitSummary.netArea + unitSummary.sharedArea || 0;
                                const unitVerandaArea = unitSummary.verandaArea || 0;
                                const computedPrice = pricePerM2 != null
                                    ? pricePerM2 * unitArea + (verandaPricePerM2 != null ? verandaPricePerM2 * unitVerandaArea : 0)
                                    : 0;

                                let unitBookletMedia: any = undefined;
                                if (typeof unitSummary.pageNumber === 'number') {
                                    try {
                                        unitBookletMedia = await createPdfPageMedia(
                                            unitSummary.pageNumber,
                                            `unit-booklet-${slugifyLabel(unitName)}-${floorKey}-page-${unitSummary.pageNumber}.pdf`,
                                            {edifice: edificeId, floor: floorKey, unit: unitName, type: 'marketingBooklet'},
                                            txSession,
                                        );
                                    } catch (bookletErr) {
                                        logger.warn(`PDF import: failed to extract unit booklet page edificeId=${edificeId} unit=${unitName} page=${unitSummary.pageNumber} error=${bookletErr instanceof Error ? bookletErr.message : String(bookletErr)}`);
                                    }
                                }

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
                                if (mainImageMedia) unitDataToCreate.mainImage = mainImageMedia;
                                if (unitBookletMedia) unitDataToCreate.marketingBooklet = unitBookletMedia;

                                await unitService.create(unitDataToCreate, {session: txSession, logger, languageCode, auditUserId: actionUserCtx.userId});
                                unitsCreated++;
                                floorTotalArea += unitDataToCreate.area;
                            }
                        }

                        if (floorTotalArea > 0) {
                            createdFloor.area = floorTotalArea;
                            await createdFloor.save({session: txSession});
                        }
                    }
                });
            } finally {
                await floorImportSession.endSession();
            }

            const floorsUpdated = Object.keys(summaryData.floors).length - floorsCreated;
            const unitsUpdated  = Object.values(summaryData.floors).reduce((t, f) => t + Object.keys(f.units).length, 0) - unitsCreated;

            logger.finish(`Successfully processed PDF: ${floorsCreated} floors created, ${floorsUpdated} floors updated, ${unitsCreated} units created, ${unitsUpdated} units updated`);
            return {
                message: `Successfully processed PDF: ${floorsCreated} floors created, ${floorsUpdated} floors updated, ${unitsCreated} units created, ${unitsUpdated} units updated`,
                floorsCreated,
                unitsCreated,
            };
        } catch (error) {
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
