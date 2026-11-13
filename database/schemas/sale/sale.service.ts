/**
 * Sale Service
 * 
 * CRUD service for Sale model.
 */

import {BaseCrudService} from '@coreModule/database/services/baseCrudService';
import Sale, {ISale} from './sale';
import type {ClientSession, FilterQuery} from "mongoose";
import {CONTRACTS_HUB_SALE_POPULATE} from "@propertyManagement/utilities/contractsHub/contractsHubMapper.dto";
import type {ObjectId} from "mongodb";

export class SaleService extends BaseCrudService<ISale, typeof Sale> {
    constructor() {
        super(Sale, 'Sale');
    }

    /** Sales with their unit, buyer and currency, for the ERP export. */
    findForErpExport(filter: FilterQuery<ISale>) {
        return this.model.find(filter)
            .select("name unit buyer saleDate finalPrice saleCurrency paymentType approvalStatus")
            .populate("unit", "name unitNumber")
            .populate("buyer", "name surname")
            .populate("saleCurrency", "abbreviation symbol")
            .lean();
    }

    /** The ids of the matching sales, as plain objects. */
    findIdsLean(filter: FilterQuery<ISale>) {
        return this.model.find(filter)
            .select("_id")
            .lean();
    }

    /** Sales of the given units with their price currency, for the ROI report. */
    findForRoi(filter: FilterQuery<ISale>) {
        return this.model.find(filter).noDeleted()
            .select("unit finalPrice saleCurrency")
            .populate("saleCurrency", "symbol decimalPlaces")
            .lean();
    }

    /** Sales populated for the contracts hub. */
    findForContractsHub(filter: FilterQuery<ISale>) {
        return this.model.find(filter)
            .populate(CONTRACTS_HUB_SALE_POPULATE)
            .lean();
    }

    /** Sales of the given units, for each unit's history. */
    findUnitHistoryLean(filter: FilterQuery<ISale>) {
        return this.model.find(filter).select("unit saleDate name status").lean();
    }

    /** The matching sale, read in the session. */
    findOneInSession(filter: FilterQuery<ISale>, session: ClientSession | null | undefined) {
        return this.model.findOne(filter).session(session).exec();
    }

    /** The units and buyers of the matching sales, as plain objects. */
    findBuyersLean(filter: FilterQuery<ISale>) {
        return this.model.find(filter).select("unit buyer").lean<{unit: ObjectId; buyer: ObjectId}[]>();
    }
}

export const saleService = new SaleService();
