import Constructor from "./constructor";
import {ICompany} from "@coreModule/database/schemas/company/company";
import {getLogger, serverLogger} from "@coreModule/loggers/serverLog";

export const defaultConstructors = [
    {
        name: "Albanian Builders Group",
        email: "info@albanianbuilders.al",
        phoneNumber: "+355 69 123 4567",
        vat: "VAT001234567",
        website: "https://albanianbuilders.al",
        description: "Leading construction company specializing in residential and commercial projects across Albania."
    },
    {
        name: "Mediterranean Construction Co.",
        email: "contact@mediterranean-construction.com",
        phoneNumber: "+355 69 234 5678",
        vat: "VAT002345678",
        website: "https://mediterranean-construction.com",
        description: "Expert builders with over 20 years of experience in modern architecture and sustainable construction."
    },
    {
        name: "Tirana Development Partners",
        email: "hello@tiranadevpartners.al",
        phoneNumber: "+355 69 345 6789",
        vat: "VAT003456789",
        website: "https://tiranadevpartners.al",
        description: "Premier development firm focused on urban planning and high-rise residential complexes."
    },
    {
        name: "Adriatic Builders Ltd",
        email: "info@adriaticbuilders.com",
        phoneNumber: "+355 69 456 7890",
        vat: "VAT004567890",
        website: "https://adriaticbuilders.com",
        description: "Specialized in luxury residential properties and boutique commercial spaces."
    },
    {
        name: "EcoConstruct Albania",
        email: "contact@ecoconstruct.al",
        phoneNumber: "+355 69 567 8901",
        vat: "VAT005678901",
        website: "https://ecoconstruct.al",
        description: "Sustainable construction solutions with focus on green building technologies and energy efficiency."
    },
    {
        name: "Heritage Restoration Builders",
        email: "info@heritagerestoration.al",
        phoneNumber: "+355 69 678 9012",
        vat: "VAT006789012",
        website: "https://heritagerestoration.al",
        description: "Experts in historical building restoration and preservation of architectural heritage."
    },
    {
        name: "Modern Structures Inc.",
        email: "hello@modernstructures.al",
        phoneNumber: "+355 69 789 0123",
        vat: "VAT007890123",
        website: "https://modernstructures.al",
        description: "Innovative construction company delivering cutting-edge architectural solutions."
    },
    {
        name: "Coastal Construction Group",
        email: "info@coastalconstruction.al",
        phoneNumber: "+355 69 890 1234",
        vat: "VAT008901234",
        website: "https://coastalconstruction.al",
        description: "Specialized in coastal properties, resorts, and waterfront developments."
    },
    {
        name: "Albanian Infrastructure Builders",
        email: "contact@infrabuilders.al",
        phoneNumber: "+355 69 901 2345",
        vat: "VAT009012345",
        website: "https://infrabuilders.al",
        description: "Large-scale infrastructure projects including roads, bridges, and public facilities."
    },
    {
        name: "Premium Home Builders",
        email: "info@premiumhomebuilders.al",
        phoneNumber: "+355 69 012 3456",
        vat: "VAT010123456",
        website: "https://premiumhomebuilders.al",
        description: "Luxury home construction with attention to detail and premium materials."
    }
];

export async function createConstructors(parentLogger: serverLogger, company: ICompany) {
    let logger = getLogger("mongoDbInitialization-createConstructors", parentLogger);
    logger.start(`Creating constructors...`);

    try {
        for (const constructorData of defaultConstructors) {
            let existingConstructor = await Constructor.findOne({vat: constructorData.vat});

            if (!existingConstructor) {
                const newConstructor = new Constructor({
                    name: constructorData.name,
                    email: constructorData.email.toLowerCase(),
                    phoneNumber: constructorData.phoneNumber,
                    vat: constructorData.vat,
                    website: constructorData.website,
                    description: constructorData.description,
                    company: company,
                    createdBy: company.createdBy,
                    addresses: []
                });

                await newConstructor.save();
                logger.debug(`Successfully created constructor: ${constructorData.name} with VAT ${constructorData.vat}`);
            } else {
                logger.debug(`Constructor with VAT ${constructorData.vat} already exists`);
            }
        }

        logger.finish(`Finished creating constructors!`);
    } catch (e: any) {
        console.log(e);
        logger.err(`Error creating constructors: ${e.message}`);
        logger.fail("Failed to create constructors!");
    }
}
