import {BaseCrudService} from "@coreModule/database/services/baseCrudService";
import TenderInvitation, {ITenderInvitation} from "./tenderInvitation";

export class TenderInvitationService extends BaseCrudService<ITenderInvitation, typeof TenderInvitation> {
    constructor() {
        super(TenderInvitation, "TenderInvitation");
    }
}

export const tenderInvitationService = new TenderInvitationService();
