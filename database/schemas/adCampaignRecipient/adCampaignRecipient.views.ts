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
                        card("email", {icon: "#Mail"}),
                        card("fullName", {icon: "#User"}),
                        card("audienceKind", {icon: "#Users", languageKeyCategory: "audienceKindEnum", type: "enum"}),
                        card("campaignType", {icon: "#Megaphone", languageKeyCategory: "campaignTypeEnum", type: "enum"}),
                        card("languageCode", {icon: "#Languages"}),
                        card("campaign", {
                            icon: "#Send",
                            linkedRefPath: "campaign",
                            parent: "campaign",
                            valuePath: ["title", "name", "_id"],
                            pickFirstTruthyValuePath: true,
                        }),
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
                        card("status", {icon: "#CircleDot", languageKeyCategory: "recipientStatusEnum", type: "enum"}),
                        card("skipReason", {icon: "#CircleSlash", languageKeyCategory: "skipReasonEnum", type: "enum"}),
                        card("attempts", {icon: "#RefreshCw"}),
                        card("sentAt", {icon: "#IconCalendarBolt", format: "datetime", type: "date"}),
                        card("unsubscribedAt", {icon: "#BellOff", format: "datetime", type: "date"}),
                        card("messageId", {icon: "#Hash"}),
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [card("lastError", {icon: "#TriangleAlert"})],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

export const adCampaignRecipientViews: ViewConfig[] = [adCampaignRecipientSheetView];
