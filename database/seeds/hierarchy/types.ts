/**
 * Row shapes for the exported property-management hierarchy seeds.
 *
 * Two id conventions live here, deliberately:
 *  - `id` / `projectId` / `edificeId` / `floorId` / `mainImageId` are verbatim
 *    ObjectId hex strings carried over from the source database. The hierarchy is
 *    self-contained, so preserving them keeps parent links and image references
 *    stable across a full re-init.
 *  - Everything pointing outside the hierarchy is a **business key**
 *    (`priceCurrencyCode`, `unitTypeName`, `constructorVats`, `countryCode`, …)
 *    because an init re-mints those documents with new ids. The seeder resolves
 *    each key against the rows the core/reference defaults just created.
 */

export type SeedPoint = {
    x: number;
    y: number;
};

export type SeedSocialLink = {
    name?: string;
    link?: string;
};

export type SeedAddress = {
    street?: string;
    postalCode?: string;
    /** ISO country code, resolved against Country.code. */
    countryCode?: string;
    /** State/region code, resolved against State.code. */
    stateCode?: string;
    /** City name, resolved against City.name. */
    cityName?: string;
    latitude?: number;
    longitude?: number;
};

export type ProjectSeedRow = {
    id: string;
    name: string;
    description?: string;
    /** Decimal128 carried as a string so the literal stays exact. */
    saleCommissionRatePercent?: string;
    reservationCommissionRatePercent?: string;
    featuredOnHomepage: boolean;
    featuredSortOrder: number;
    magazineTitle?: string;
    magazineDescription?: string;
    socialLinks: SeedSocialLink[];
    mainImageId?: string;
};

export type EdificeSeedRow = {
    id: string;
    projectId?: string;
    name: string;
    address?: SeedAddress;
    commercialFacilities: string[];
    neighborhoodFacilities: string[];
    investmentValue?: string;
    /** Currency abbreviation, resolved against Currency.abbreviation. */
    investmentCurrencyCode?: string;
    pricePerMeterSquared?: number;
    verandaPricePerMeterSquared?: number;
    saleCurrencyCode?: string;
    /** Constructor VATs, resolved against Constructor.vat. */
    constructorVats: string[];
    polygonCoordinates: SeedPoint[];
    constructionStartDate?: string;
    expectedCompletionDate?: string;
    distanceFromCityCenter?: number;
    energyClass?: string;
    greenArea?: number;
    totalArea?: number;
    numberOfFloors?: number;
    numberOfFloorsAboveGround?: number;
    numberOfFloorsUnderGround?: number;
    numberOfGarages?: number;
    numberOfParkingSpaces?: number;
    mainImageId?: string;
};

export type FloorSeedRow = {
    id: string;
    edificeId?: string;
    projectId?: string;
    name: string;
    levelNumber?: number;
    area?: number;
    isAccessible: boolean;
    hasEmergencyExit: boolean;
    sharedSpaces: string[];
    polygonCoordinates: SeedPoint[];
    mainImageId?: string;
};

export type UnitSeedRow = {
    id: string;
    floorId?: string;
    edificeId?: string;
    projectId?: string;
    /** Unit type name, resolved against UnitType.name. */
    unitTypeName?: string;
    unitNumber: string;
    name: string;
    area?: number;
    sharedArea?: number;
    netArea?: number;
    verandaArea?: number;
    price?: string;
    priceCurrencyCode?: string;
    hasBalcony: boolean;
    hasTerrace: boolean;
    hasSeaView: boolean;
    hasCityView: boolean;
    hasLakeView: boolean;
    hasElevator: boolean;
    orientation?: string;
    constructionStatus?: string;
    numberOfRooms?: number;
    numberOfBathrooms?: number;
    description?: string;
    saleCommissionRatePercent?: string;
    reservationCommissionRatePercent?: string;
    polygonCoordinates: SeedPoint[];
    featuredOnHomepage: boolean;
    featuredSortOrder: number;
    mainImageId?: string;
};

export type HierarchyMediaSeedRow = {
    /** Preserved Media._id — this is what the hierarchy rows reference. */
    mediaId: string;
    fileName: string;
    /** Basename inside `seeds/hierarchy/media/`. */
    assetFile: string;
    mimeType: string;
    extension: string;
    fileSize: number;
    type: string;
    resolution?: {width: number; height: number};
};
