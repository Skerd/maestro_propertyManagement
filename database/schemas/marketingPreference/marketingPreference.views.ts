import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "email"},
                            field: {name: "email", widget: "#DisplayCard", label: "email", widgetProps: {icon: "#Mail"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "allowPriceChange"},
                            field: {name: "allowPriceChange", widget: "#DisplayCard", label: "allowPriceChange", widgetProps: {icon: "#TrendingDown", languageKeyCategory: "activeState", variantLookupField: "allowPriceChange"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "allowOffers"},
                            field: {name: "allowOffers", widget: "#DisplayCard", label: "allowOffers", widgetProps: {icon: "#Tag", languageKeyCategory: "activeState", variantLookupField: "allowOffers"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "allowNewProjects"},
                            field: {name: "allowNewProjects", widget: "#DisplayCard", label: "allowNewProjects", widgetProps: {icon: "#Building2", languageKeyCategory: "activeState", variantLookupField: "allowNewProjects"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "unsubscribedAllAt"},
                            field: {name: "unsubscribedAllAt", widget: "#DisplayCard", label: "unsubscribedAllAt", widgetProps: {icon: "#BellOff", format: "datetime", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "source"},
                            field: {name: "source", widget: "#DisplayCard", label: "source", widgetProps: {icon: "#Pointer", languageKeyCategory: "sourceEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "lastChangedAt"},
                            field: {name: "lastChangedAt", widget: "#DisplayCard", label: "lastChangedAt", widgetProps: {icon: "#IconCalendarBolt", format: "datetime", type: "date"}},
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

export const marketingPreferenceViews: ViewConfig[] = [marketingPreferenceSheetView];
