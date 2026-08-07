import {ObjectId} from 'mongodb';
import {z} from 'zod';
import {action} from '@coreModule/api/actionDecorator';
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
}
