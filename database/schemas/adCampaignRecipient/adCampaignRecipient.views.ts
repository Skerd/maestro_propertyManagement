import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

/**
 * Sheet only — recipient rows are machine-written, so there is deliberately no
 * create or edit form. The list page renders them as a table from the generated
 * table config.
 */
export const adCampaignRecipientSheetView: ViewConfig = {
    model: "adcampaignrecipients",
    viewType: "sheet",
    accessModel: "adcampaignrecipients",
    apiUrl: "/api/realEstate/adCampaignRecipient",
    header: {titleField: "email", subtitleKey: "adCampaignRecipient", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            permissions: {readAny: ["email", "fullName", "audienceKind", "campaignType", "languageCode", "campaign"]},
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
                            permissions: {read: "fullName"},
                            field: {name: "fullName", widget: "#DisplayCard", label: "fullName", widgetProps: {icon: "#User"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "audienceKind"},
                            field: {name: "audienceKind", widget: "#DisplayCard", label: "audienceKind", widgetProps: {icon: "#Users", languageKeyCategory: "audienceKindEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "campaignType"},
                            field: {name: "campaignType", widget: "#DisplayCard", label: "campaignType", widgetProps: {icon: "#Megaphone", languageKeyCategory: "campaignTypeEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "languageCode"},
                            field: {name: "languageCode", widget: "#DisplayCard", label: "languageCode", widgetProps: {icon: "#Languages"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "campaign"},
                            field: {
                                name: "campaign",
                                widget: "#DisplayCard",
                                label: "campaign",
                                widgetProps: {
                                    icon: "#Send",
                                    linkedRefPath: "campaign",
                                    parent: "campaign",
                                    valuePath: ["title", "name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "delivery"},
            permissions: {readAny: ["status", "skipReason", "attempts", "sentAt", "messageId", "lastError", "unsubscribedAt"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "status"},
                            field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "recipientStatusEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "skipReason"},
                            field: {name: "skipReason", widget: "#DisplayCard", label: "skipReason", widgetProps: {icon: "#CircleSlash", languageKeyCategory: "skipReasonEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "attempts"},
                            field: {name: "attempts", widget: "#DisplayCard", label: "attempts", widgetProps: {icon: "#RefreshCw"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "sentAt"},
                            field: {name: "sentAt", widget: "#DisplayCard", label: "sentAt", widgetProps: {icon: "#IconCalendarBolt", format: "datetime", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "unsubscribedAt"},
                            field: {name: "unsubscribedAt", widget: "#DisplayCard", label: "unsubscribedAt", widgetProps: {icon: "#BellOff", format: "datetime", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "messageId"},
                            field: {name: "messageId", widget: "#DisplayCard", label: "messageId", widgetProps: {icon: "#Hash"}},
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "lastError"},
                            field: {name: "lastError", widget: "#DisplayCard", label: "lastError", widgetProps: {icon: "#TriangleAlert"}},
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

export const adCampaignRecipientViews: ViewConfig[] = [adCampaignRecipientSheetView];
