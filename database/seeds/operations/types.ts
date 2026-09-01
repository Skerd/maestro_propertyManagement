/**
 * Row shapes for the exported property-management operations seeds.
 *
 * Reference encoding, matching `seeds/hierarchy/types.ts`:
 *  - A bare hex string is a **preserved ObjectId** for a PM-internal document
 *    (unit, floor, edifice, project, sale, reservation, lease, …). The whole PM graph
 *    keeps its original ids, so these links need no remapping.
 *  - `{$user}` / `{$currency}` / `{$storyType}` are **business keys** resolved at seed
 *    time against `User.username`, `Currency.abbreviation` and `StoryType.slug`,
 *    because an init re-mints those documents.
 *  - Decimal128 values are carried as strings so the literals stay exact.
 *  - Dates are ISO strings.
 *  - Media references are not exported for these entities (no binaries shipped), with
 *    the single exception of `Story.mainImage`, which the schema requires.
 */

export type UserRef = {$user: string};
export type CurrencyRef = {$currency: string};
export type StoryTypeRef = {$storyType: string};

/** A preserved ObjectId hex string. */
export type PreservedId = string;

export type ReservationSeedRow = {
    id: PreservedId;
    unit: PreservedId;
    reservedBy: UserRef;
    client: UserRef;
    reservationDate: string;
    expirationDate: string;
    reservationNotes: string;
    depositAmount: string;
    depositCurrency: CurrencyRef;
    paymentMethod: string;
    source: string;
    paid: boolean;
    isActive: boolean;
    /** active | expired | cancelled | converted — only `active` reserves the unit. */
    status: string;
    cancelledAt: string | null;
    cancellationReason: string | null;
    expiredAt: string | null;
};

export type SaleSeedRow = {
    id: PreservedId;
    unit: PreservedId;
    paymentType: string;
    buyer: UserRef;
    soldBy: UserRef;
    saleDate: string;
    listedUnitPrice: string;
    listedUnitCurrency: CurrencyRef;
    saleExchangeRate: string;
    localDiscount: string;
    finalPrice: string;
    saleCurrency: CurrencyRef;
    notes: string;
    transactionReference: string;
    handoverDate?: string | null;
    handedOverBy?: UserRef;
    handoverNotes?: string;
    titleTransferDate?: string;
    deedNumber?: string;
    notaryName?: string;
    reservation?: PreservedId;
    reservationDepositAmount?: string;
    reservationDepositCurrency?: CurrencyRef;
    reservationExchangeRate?: string;
    reservationConvertedAmount?: string;
    paymentPlan?: PreservedId;
};

export type PaymentPlanInstallment = {
    installmentNumber: number;
    dueDate: string;
    amount: string;
    principalAmount: string;
    interestAmount: string;
    status: string;
    paidAmount: string | null;
    paidDate: string | null;
    notes: string | null;
};

export type PaymentPlanSeedRow = {
    id: PreservedId;
    sale: PreservedId;
    status: string;
    totalAmount: string;
    downPayment: string;
    downPaymentPaid: boolean;
    downPaymentDate: string;
    remainingBalance: string;
    numberOfInstallments: number;
    installmentAmount: string;
    interestRate: number;
    startDate: string;
    endDate: string;
    installments: PaymentPlanInstallment[];
    gracePeriodDays: number;
    lateFeePercentage: number;
    notes: string;
    restructureHistory: unknown[];
};

export type LeaseSeedRow = {
    id: PreservedId;
    unit: PreservedId;
    tenant: UserRef;
    startDate: string;
    endDate: string;
    monthlyRent: string;
    rentCurrency: CurrencyRef;
    depositAmount: string;
    depositPaid: boolean;
    depositReturnedAt: string | null;
    /** active | expired | terminated — only `active` rents the unit. */
    status: string;
    notes: string;
    terminationDate?: string;
    terminationReason?: string;
};

export type RentalPaymentSeedRow = {
    id: PreservedId;
    lease: PreservedId;
    unit: PreservedId;
    dueDate: string;
    amount: string;
    currency: CurrencyRef;
    status: string;
    notes: string;
    paidDate?: string;
    paidAmount?: string;
};

export type CommissionSeedRow = {
    id: PreservedId;
    agent: UserRef;
    recordedByActionUser: UserRef;
    sourceType: string;
    /** Points at the reservation or sale named by `sourceType`. */
    sourceId: PreservedId;
    reservation?: PreservedId;
    sale?: PreservedId;
    basis: string;
    basisAmount: string;
    ratePercent: number;
    amount: string;
    currency: CurrencyRef;
    status: string;
    notes: string;
    paidAt: string | null;
    voidedAt?: string | null;
    paymentReference: string | null;
};

export type LeadActivityEntry = {
    action: string;
    notes: string;
    performedBy: UserRef;
    performedAt: string;
};

export type LeadSeedRow = {
    id: PreservedId;
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    status: string;
    source: string;
    projectInterest?: PreservedId;
    unitInterest?: PreservedId;
    interest?: string;
    budget?: string;
    budgetCurrency?: CurrencyRef;
    notes?: string;
    assignedTo?: UserRef;
    followUpDate?: string | null;
    convertedAt?: string | null;
    activityLog: LeadActivityEntry[];
};

export type ExpenditureItem = {
    title: string;
    category: string;
    amount: number;
    unit: string;
    pricePerUnit: string;
};

export type UnitCostSeedRow = {
    id: PreservedId;
    unit?: PreservedId;
    floor?: PreservedId;
    edifice?: PreservedId;
    project: PreservedId;
    purchasePerson: UserRef;
    purchaseDate: string;
    paymentDate?: string | null;
    notes: string;
    verificationStatus: string;
    paymentStatus: string;
    tag: string;
    currency: CurrencyRef;
    invoiceNumber: string;
    vendorName: string;
    expenditureItems: ExpenditureItem[];
    budgetedAmount: string;
};

export type InspectionIssue = {
    notes: string;
    severity: string;
};

export type InspectionFindings = {
    structuralIssues: InspectionIssue[];
    electricalIssues: InspectionIssue[];
    plumbingIssues: InspectionIssue[];
    hvacIssues: InspectionIssue[];
    safetyConcerns: InspectionIssue[];
    cosmeticIssues: InspectionIssue[];
    otherObservations: InspectionIssue[];
};

export type InspectionSeedRow = {
    id: PreservedId;
    unit: PreservedId;
    inspectedBy: UserRef;
    inspectionDate: string;
    scheduledDate: string;
    type: string;
    status: string;
    notes: string;
    followUpRequired: boolean;
    findings?: InspectionFindings;
    rating?: number;
    completedAt?: string;
    nextInspectionDate?: string;
};

export type ApprovalStep = {
    decision: string;
    user?: UserRef;
    notes?: string;
    reviewedAt?: string;
    materialsPlan?: MaterialsPlanItem[];
    inspections?: PreservedId[];
};

export type MaterialsPlanItem = {
    item: string;
    quantity: number;
    unit: string;
    notes: string;
    pricePerUnit: string;
    currency: CurrencyRef;
};

export type CostBreakdownItem = {
    item: string;
    cost: number;
    quantity: number;
    unit: string;
    source: string;
};

export type ModificationRequestSeedRow = {
    id: PreservedId;
    unit: PreservedId;
    requestedBy: UserRef;
    title: string;
    description: string;
    constructionType: string;
    specifications: string;
    status: string;
    architectApproval: ApprovalStep;
    engineerApproval: ApprovalStep;
    ceoApproval: ApprovalStep;
    deliveryApproval: ApprovalStep;
    clientCostApproval?: ApprovalStep;
    notificationSent: boolean;
    submittedAt: string;
    stageDueDate: string | null;
    completedAt: string | null;
    clientNotifiedAt?: string;
    inspections: PreservedId[];
    financeDetails?: {
        totalCost: number;
        currency: CurrencyRef;
        costBreakdown: CostBreakdownItem[];
        notes: string;
        estimatedCompletionDate: string;
    };
};

export type SnagSeedRow = {
    id: PreservedId;
    unit: PreservedId;
    title: string;
    description: string;
    location: string;
    status: string;
    severity: string;
    reportedBy: UserRef;
    assignedTo: UserRef;
    dueDate: string;
    resolvedAt: string | null;
    notes: string;
};

export type StoryTypeSeedRow = {
    id: PreservedId;
    /** Display name — authored, not auto-generated, so it is preserved. */
    name: string;
    slug: string;
    description: string;
    sortOrder: number;
};

export type StorySeedRow = {
    id: PreservedId;
    name: string;
    project: PreservedId;
    title: string;
    content: string;
    excerpt: string;
    published: boolean;
    publishedAt: string;
    sortOrder: number;
    storyType?: StoryTypeRef;
};

export type ConstructionUpdateSeedRow = {
    id: PreservedId;
    project: PreservedId;
    edifice: PreservedId;
    title: string;
    description: string;
    progressPercent: number;
    updateDate: string;
};

export type PropertyManagementConfigSeedRow = {
    id: PreservedId;
    requiresSaleApproval: boolean;
    requiresHandoverPackageForHandover: boolean;
};
