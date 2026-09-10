import {ObjectId} from 'mongodb';
import {z} from 'zod';
import {action} from '@coreModule/api/actionDecorator';
import SchemaGuard from '@coreModule/database/security/schemaGuard';
import {apiValidationException} from 'armonia/src/modules/core/helpers/exceptions';
import {validateSingleForm} from 'armonia/src/modules/core/utilities/zod/shared.validator';
import {markUnavailableFormSchema} from 'armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/markUnavailable.form.validator';
import type {MarkUnavailableForm, MarkUnavailableResponse} from 'armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/markUnavailable.form.type';
import type {ActionMessage} from 'armonia/src/modules/core/types/shared.types';
import {UnitStatus} from 'armonia/src/modules/propertyManagement/api/realEstate/private/unit/unit/unit.constants';
import Unit from './unit';
import {unitService} from './unit.service';
import {buildUnitMarketingBookletPdf} from '../../../utilities/marketing/marketingBooklet.util';

function generateMarketingBookletSchema() {
    return z.object({unitId: z.string().min(1)});
}

export class UnitActions {

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 20},
        schema: (_lang, _form) => generateMarketingBookletSchema(),
    })
    async generateMarketingBooklet(params: any, _queryParams: any, _req: any, res: any): Promise<void> {
        const {unitId, company, logger, languageCode} = params;

        logger.start(`Generating marketing booklet for unit ${unitId}...`);

        // Ensure the unit exists in this company before merge (clearer error than util throw).
        await unitService.findOneOrThrow(
            {_id: new ObjectId(unitId), company: company._id},
            {logger, languageCode},
        );

        const {buffer, filename} = await buildUnitMarketingBookletPdf({
            unitId: new ObjectId(unitId),
            companyId: company._id,
            languageCode,
            logger,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);

        logger.finish(`Marketing booklet generated for unit ${unitId}`);
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: markUnavailableFormSchema,
    })
    async markUnavailable(params: Record<string, any>): Promise<MarkUnavailableResponse> {
        const {logger, languageCode, session, _id, unavailableNotes, actionUserCtx, company} =
            params as Record<string, any> & MarkUnavailableForm;

        logger.start(`Marking unit unavailable: ${_id}...`);

        try {
            SchemaGuard.sanitizeFields(Unit, {status: {}, unavailableNotes: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("unit_not_found", "", null, languageCode);
        }

        const unit = await unitService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (unit.status !== UnitStatus.AVAILABLE) {
            throw apiValidationException("unit_cannot_mark_unavailable", "", null, languageCode);
        }

        const notes = unavailableNotes.trim();
        unit.status = UnitStatus.UNAVAILABLE;
        unit.unavailableNotes = notes;
        unit.$locals = unit.$locals || {};
        unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await unit.save({session});

        logger.finish(`Unit ${_id} marked unavailable`);
        return {status: UnitStatus.UNAVAILABLE, unavailableNotes: notes};
    }

    @action({
        auth: "private",
        rateLimit: {windowMs: 60000, max: 30},
        transaction: true,
        schema: validateSingleForm,
    })
    async markAvailable(params: Record<string, any>): Promise<ActionMessage> {
        const {logger, languageCode, session, _id, actionUserCtx, company} = params;

        logger.start(`Marking unit available: ${_id}...`);

        try {
            SchemaGuard.sanitizeFields(Unit, {status: {}}, "write", actionUserCtx, languageCode);
        } catch {
            throw apiValidationException("unit_not_found", "", null, languageCode);
        }

        const unit = await unitService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );

        if (unit.status !== UnitStatus.UNAVAILABLE) {
            throw apiValidationException("unit_cannot_mark_available", "", null, languageCode);
        }

        unit.status = UnitStatus.AVAILABLE;
        unit.unavailableNotes = undefined;
        unit.$locals = unit.$locals || {};
        unit.$locals.auditUserId = new ObjectId(actionUserCtx.userId);
        await unit.save({session});

        logger.finish(`Unit ${_id} marked available`);
        return {message: "Unit marked available"};
    }
}
