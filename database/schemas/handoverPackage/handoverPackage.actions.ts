import {ObjectId} from "mongodb";
import {action} from "@coreModule/api/actionDecorator";
import {apiValidationException} from "armonia/src/modules/core/helpers/exceptions";
import {updateHandoverItemsFormSchema} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/updateHandoverItems.form.validator";
import {saleService} from "../sale/sale.service";
import {saleToDTO} from "@propertyManagement/utilities/mappers/sale/saleMapper.dto";
import {
    applyHandoverItemPatches,
    salesWithHandoverContext,
    syncSaleHandoverChecklist,
    toChecklistRows,
} from "@propertyManagement/utilities/handoverPackage/handoverPackageChecklist";

export class HandoverPackageActions {

    @action({auth: "private", rateLimit: {windowMs: 60000, max: 30}, transaction: true, schema: updateHandoverItemsFormSchema})
    async updateHandoverItems(params: Record<string, any>): Promise<any> {
        const {logger, languageCode, session, actionUserCtx, company, _id, items} = params;
        logger.start(`HandoverPackage.updateHandoverItems sale ` + String(_id) + `...`);
        const sale = await saleService.findOneOrThrow(
            {_id: new ObjectId(_id), company: company._id},
            {session, logger, languageCode},
        );
        if (sale.titleTransferDate) {
            throw apiValidationException("handover_package_title_already_transferred", "", null, languageCode);
        }
        const synced = await syncSaleHandoverChecklist(sale, company._id, {session, logger, languageCode});
        const nextItems = applyHandoverItemPatches(
            toChecklistRows(synced.sale.handoverChecklistItems),
            items,
            actionUserCtx.userId,
        );
        await saleService.updateByIdOrThrow(
            sale._id,
            {$set: {handoverChecklistItems: nextItems}},
            {session, logger, languageCode, auditUserId: actionUserCtx.userId},
        );
        const updated = await saleService.findById(sale._id, {session, logger, languageCode});
        if (!updated) return saleToDTO(sale);
        const [dto] = await salesWithHandoverContext([updated], {company, session, logger, languageCode});
        logger.finish(`HandoverPackage.updateHandoverItems done`);
        return dto;
    }
}
