/** Display names snapshotted at send time — never ObjectIds. */
export interface UnitLocationForEmail {
    projectName?: string;
    edificeName?: string;
    floorName?: string;
}

export interface ReservationClientEmailEvent extends UnitLocationForEmail {
    eventType: "reservation_client_email";
    email: string;
    userId: string;
    fullName: string;
    languageCode: string;
    timestamp: number;
    kind: "created" | "paid" | "expiration_reminder" | "expiration_expired" | "remaining_days";
    reminderPhase?: "3" | "1" | "0";
    /** Calendar days left until expiration day (UTC); used for `remaining_days` emails. */
    daysRemaining?: number;
    companyId: string;
    companyName: string;
    reservationId: string;
    reservationCode?: string;
    unitNumber?: string;
    /** Human-readable unit title (distinct from unit number). */
    unitDisplayName?: string;
    /** Localized listing price with currency, e.g. "120,000.00 EUR". */
    unitPriceDisplay?: string;
    /** Deposit / reservation amount with currency (created & paid emails). */
    reservationDepositDisplay?: string;
    /** GridFS-backed contract media id — attached on "created" emails when load succeeds. */
    reservationContractMediaId?: string;
    expirationDateIso?: string;
    expirationDateFormatted?: string;
    depositSummary?: string;
}

export interface SaleClientEmailEvent extends UnitLocationForEmail {
    eventType: "sale_client_email";
    email: string;
    userId: string;
    fullName: string;
    languageCode: string;
    timestamp: number;
    kind: "sale_created" | "installment_reminder" | "installment_remaining_days" | "installment_overdue";
    reminderPhase?: "3" | "1" | "0";
    daysRemaining?: number;
    companyId: string;
    companyName: string;
    saleId: string;
    saleCode?: string;
    paymentType: "cash" | "payment_plan";
    unitNumber?: string;
    unitDisplayName?: string;
    unitPriceDisplay?: string;
    finalPriceDisplay?: string;
    /** Payment plan summary (sale_created with payment_plan only). */
    downPaymentDisplay?: string;
    numberOfInstallments?: number;
    /** Installment emails */
    installmentNumber?: number;
    installmentAmountDisplay?: string;
    installmentDueDateIso?: string;
    installmentDueDateFormatted?: string;
    purchaseContractMediaId?: string;
}

export interface LeaseClientEmailEvent extends UnitLocationForEmail {
    eventType: "lease_client_email";
    email: string;
    userId: string;
    fullName: string;
    languageCode: string;
    timestamp: number;
    kind: "rent_reminder" | "rent_overdue";
    reminderPhase?: "3" | "1" | "0";
    companyId: string;
    companyName: string;
    leaseId: string;
    leaseCode?: string;
    unitNumber?: string;
    unitDisplayName?: string;
    /** Remaining on the month (includes late fee); never the original amount on a partial month. */
    rentRemainingDisplay?: string;
    dueDateIso?: string;
    dueDateFormatted?: string;
}
