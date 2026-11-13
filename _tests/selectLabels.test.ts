/** TD-B211 / TD-B212: picker labels are written in the caller's language, never as codes (UX-09). */
import {describe, expect, it} from "vitest";
import Inspection from "@propertyManagement/database/schemas/inspection/inspection";
import AdCampaignTemplate from "@propertyManagement/database/schemas/adCampaignTemplate/adCampaignTemplate";
import {inspectionsToSelect} from "@propertyManagement/utilities/mappers/inspection/inspectionMapper.select";
import {adCampaignTemplatesToSelect} from "@propertyManagement/utilities/mappers/adCampaignTemplate/adCampaignTemplateMapper.select";

describe("inspection picker labels", () => {
    const followUp = new Inspection({name: "INSP-20261120-ABCD1234", type: "follow_up", inspectionDate: "2026-11-20"});
    const labels = (languageCode: string) => inspectionsToSelect([followUp], languageCode).map((option) => option.label);

    it("reads the type and the day in each language", () => {
        expect(labels("en-US")).toEqual(["Follow-up · Nov 20, 2026"]);
        expect(labels("de-CH")).toEqual(["Nachkontrolle · 20. Nov. 2026"]);
        expect(labels("sq-AL")[0]).toMatch(/^Përcjellja · 20 nën 2026$/);
        expect(labels("fr-FR")[0]).toMatch(/^Suivi · 20 nov\. 2026$/);
        expect(labels("it-IT")[0]).toMatch(/^Follow-up · 20 nov 2026$/);
    });

    it("falls back to English for another language, and to the code without type and day", () => {
        expect(labels("es-ES")).toEqual(["Follow-up · Nov 20, 2026"]);
        const bare = new Inspection({name: "INSP-20261120-ABCD1234"});
        bare.set("type", undefined);
        expect(inspectionsToSelect([bare], "en-US")[0].label).toBe("INSP-20261120-ABCD1234");
    });
});

describe("ad campaign template picker labels", () => {
    const templates = [
        new AdCampaignTemplate({name: "Spring offer", locale: "sq-AL"}),
        new AdCampaignTemplate({name: "Spring offer", locale: "de-CH"}),
    ];

    it("names the template's language in the caller's language", () => {
        expect(adCampaignTemplatesToSelect(templates, "en-US").map((option) => option.label)).toEqual(["Spring offer (Albanian)", "Spring offer (German)"]);
        expect(adCampaignTemplatesToSelect(templates, "de-CH").map((option) => option.label)).toEqual(["Spring offer (Albanisch)", "Spring offer (Deutsch)"]);
        expect(adCampaignTemplatesToSelect(templates, "sq-AL").map((option) => option.label)).toEqual(["Spring offer (Shqip)", "Spring offer (Gjermanisht)"]);
    });

    it("shows the bare name of a row read without its locale", () => {
        const bare = new AdCampaignTemplate({name: "Spring offer"});
        expect(adCampaignTemplatesToSelect([bare], "en-US")[0].label).toBe("Spring offer");
    });
});
