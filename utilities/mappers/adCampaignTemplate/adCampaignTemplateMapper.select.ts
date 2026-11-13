import type {ApiSelectDatum} from "armonia/src/modules/core/types/shared.types";
import {resolveEmailLocaleTag} from "@coreModule/utilities/emails/emailLocale";
import type {IAdCampaignTemplate} from "../../../database/schemas/adCampaignTemplate/adCampaignTemplate";

/** "Albanian" for `sq-AL`, named in the caller's language (UX-09); the code when the runtime has no name for it. */
function languageName(locale: string, names: Intl.DisplayNames, localeTag: string): string {
    const name = names.of(locale.split("-")[0]);
    return name ? name.charAt(0).toLocaleUpperCase(localeTag) + name.slice(1) : locale;
}

export function adCampaignTemplatesToSelect(docs: IAdCampaignTemplate[], languageCode: string): ApiSelectDatum[] {
    const localeTag = resolveEmailLocaleTag(languageCode);
    const names = new Intl.DisplayNames([localeTag], {type: "language"});
    return docs.map((doc) => ({
        value: doc._id.toString(),
        // Language-qualified: the picker shows every locale sibling, and they all
        // share a name, so the bare name would be ambiguous. A row read without
        // its locale shows the bare name, never "(undefined)" (TD-F78).
        label: doc.locale ? `${doc.name} (${languageName(doc.locale, names, localeTag)})` : doc.name,
    }));
}
