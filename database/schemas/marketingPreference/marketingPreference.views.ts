import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

type ViewNode = ViewConfig["nodes"][number];

function card(name: string, widgetProps: Record<string, unknown>): ViewNode {
    return {
        render: "#DisplayCard",
        permissions: {read: name},
        field: {name, widget: "#DisplayCard", label: name, widgetProps},
    };
}

/**
 * Sheet only.
 *
 * Staff read these rows to answer "why didn't this person get the campaign",
 * but they are written by the person themselves — from the account page or the
 * unsubscribe link — so there is no staff-facing edit form. An admin who needs
 * to record a consent change out of band does it through a dedicated action, so
 * that `source` stays honest.
 */
export const marketingPreferenceSheetView: ViewConfig = {
    model: "marketingpreferences",
    viewType: "sheet",
    accessModel: "marketingpreferences",
    apiUrl: "/api/realEstate/marketingPreference",
    header: {titleField: "email", subtitleKey: "marketingPreference", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            permissions: {
                readAny: ["email", "user", "lead", "allowPriceChange", "allowOffers", "allowNewProjects", "unsubscribedAllAt", "source", "lastChangedAt"],
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        card("email", {icon: "#Mail"}),
                        card("allowPriceChange", {icon: "#TrendingDown", languageKeyCategory: "activeState", variantLookupField: "allowPriceChange"}),
                        card("allowOffers", {icon: "#Tag", languageKeyCategory: "activeState", variantLookupField: "allowOffers"}),
                        card("allowNewProjects", {icon: "#Building2", languageKeyCategory: "activeState", variantLookupField: "allowNewProjects"}),
                        card("unsubscribedAllAt", {icon: "#BellOff", format: "datetime", type: "date"}),
                        card("source", {icon: "#Pointer", languageKeyCategory: "sourceEnum", type: "enum"}),
                        card("lastChangedAt", {icon: "#IconCalendarBolt", format: "datetime", type: "date"}),
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

export const marketingPreferenceViews: ViewConfig[] = [marketingPreferenceSheetView];
