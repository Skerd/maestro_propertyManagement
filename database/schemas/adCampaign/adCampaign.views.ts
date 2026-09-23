import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    AD_CAMPAIGN_AUDIENCE_MODE_VALUES,
    AD_CAMPAIGN_BATCH_SIZE_MAX,
    AD_CAMPAIGN_BATCH_SIZE_MIN,
    AD_CAMPAIGN_BODY_MAX,
    AD_CAMPAIGN_PLACEHOLDERS,
    AD_CAMPAIGN_SUBJECT_MAX,
    AD_CAMPAIGN_TITLE_MAX,
    AD_CAMPAIGN_TYPE_VALUES,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

type ViewNode = ViewConfig["nodes"][number];

const campaignTypeOptions = AD_CAMPAIGN_TYPE_VALUES.map(value => ({value, label: `form.campaignType.${value}`}));
const audienceModeOptions = AD_CAMPAIGN_AUDIENCE_MODE_VALUES.map(value => ({value, label: `form.audienceMode.${value}`}));

function card(name: string, widgetProps: Record<string, unknown>): ViewNode {
    return {
        render: "#DisplayCard",
        permissions: {read: name},
        field: {name, widget: "#DisplayCard", label: name, widgetProps},
    };
}

function field(node: ViewNode, name: string, edit: boolean): ViewNode {
    return edit ? {...node, permissions: {read: name, write: name}} : node;
}

/** An `#ObjectIdChipsInput` bound to a `/select` endpoint. */
function chips(
    name: string,
    apiUrl: string,
    edit: boolean,
    extraWidgetProps: Record<string, unknown> = {},
): ViewNode {
    return field({
        render: "#Field",
        field: {
            name,
            widget: "#ObjectIdChipsInput",
            label: `form.${name}Label`,
            widgetProps: {
                apiUrl,
                method: "POST",
                placeholderKey: `form.select${name.charAt(0).toUpperCase()}${name.slice(1)}`,
                removeTooltipKey: "form.removeItem",
                selectPageSizeCreate: 50,
                selectPageSizeEdit: 200,
                labelRefFormExtraKey: name,
                ...extraWidgetProps,
            },
        },
    }, name, edit);
}

export const adCampaignSheetView: ViewConfig = {
    model: "adcampaigns",
    viewType: "sheet",
    accessModel: "adcampaigns",
    apiUrl: "/api/realEstate/adCampaign",
    header: {titleField: "title", subtitleKey: "adCampaign", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            permissions: {readAny: ["name", "title", "campaignType", "status", "template", "scheduledAt", "startedAt", "completedAt"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        card("name", {icon: "#Hash"}),
                        card("campaignType", {icon: "#Megaphone", languageKeyCategory: "campaignTypeEnum", type: "enum"}),
                        card("status", {icon: "#CircleDot", languageKeyCategory: "statusEnum", type: "enum"}),
                        card("template", {
                            icon: "#Mail",
                            linkedRefPath: "template",
                            parent: "template",
                            valuePath: ["name", "_id"],
                            pickFirstTruthyValuePath: true,
                        }),
                        card("scheduledAt", {icon: "#IconCalendarBolt", format: "datetime", type: "date"}),
                        card("startedAt", {icon: "#Play", format: "datetime", type: "date"}),
                        card("completedAt", {icon: "#CircleCheck", format: "datetime", type: "date"}),
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "results"},
            permissions: {readAny: ["stats", "lastError"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 5},
                    children: [
                        card("stats.total", {icon: "#Users", label: "stats.total"}),
                        card("stats.sent", {icon: "#Send", label: "stats.sent"}),
                        card("stats.pending", {icon: "#Clock", label: "stats.pending"}),
                        card("stats.failed", {icon: "#TriangleAlert", label: "stats.failed"}),
                        card("stats.skipped", {icon: "#CircleSlash", label: "stats.skipped"}),
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

function formNodes(edit: boolean): ViewConfig["nodes"] {
    return [
        {
            render: "#TitleWithCollapse",
            props: {title: "generalInfo"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 2},
                    children: [
                        field({
                            render: "#Field",
                            field: {
                                name: "title",
                                widget: "#Input",
                                label: "form.titleLabel",
                                placeholder: "form.titlePlaceholder",
                                required: true,
                                widgetProps: {maxLength: AD_CAMPAIGN_TITLE_MAX},
                            },
                        }, "title", edit),
                        field({
                            render: "#Field",
                            field: {
                                name: "campaignType",
                                widget: "#SimpleSelect",
                                label: "form.campaignTypeLabel",
                                placeholder: "form.campaignTypePlaceholder",
                                required: true,
                                widgetProps: {options: campaignTypeOptions, className: "grow w-full"},
                            },
                        }, "campaignType", edit),
                        field({
                            render: "#Field",
                            field: {
                                name: "template",
                                widget: "#ApiSelect",
                                label: "form.templateLabel",
                                placeholder: "form.templatePlaceholder",
                                required: true,
                                widgetProps: {
                                    apiUrl: "/api/realEstate/adCampaignTemplate/select",
                                    method: "POST",
                                    className: "grow w-full",
                                },
                            },
                        }, "template", edit),
                        field({
                            render: "#Field",
                            field: {
                                name: "scheduledAt",
                                widget: "#DateInput",
                                label: "form.scheduledAtLabel",
                                placeholder: "form.scheduledAtPlaceholder",
                                widgetProps: {withTime: true},
                            },
                        }, "scheduledAt", edit),
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "audience"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 1},
                    children: [
                        field({
                            render: "#Field",
                            field: {
                                name: "audienceMode",
                                widget: "#SimpleSelect",
                                label: "form.audienceModeLabel",
                                placeholder: "form.audienceModePlaceholder",
                                required: true,
                                widgetProps: {options: audienceModeOptions, className: "grow w-full"},
                            },
                        }, "audienceMode", edit),
                        // Explicit lists — cleared when switching to "all" so a
                        // stale selection can never silently narrow a send-to-all.
                        {
                            render: "#FormWhenFieldValueIn",
                            props: {
                                watchField: "audienceMode",
                                whenValues: ["selected"],
                                clearFields: ["recipients", "leadRecipients"],
                            },
                            children: [
                                chips("recipients", "/api/company/users/select", edit),
                                chips("leadRecipients", "/api/realEstate/lead/select", edit),
                            ],
                        },
                        // Whole-audience switches — cleared when switching back to
                        // "selected" for the same reason.
                        {
                            render: "#FormWhenFieldValueIn",
                            props: {
                                watchField: "audienceMode",
                                whenValues: ["all"],
                                clearFields: ["includeClientUsers", "includeLeads"],
                            },
                            children: [
                                field({
                                    render: "#Field",
                                    field: {name: "includeClientUsers", widget: "#Switch", label: "form.includeClientUsersLabel"},
                                }, "includeClientUsers", edit),
                                field({
                                    render: "#Field",
                                    field: {name: "includeLeads", widget: "#Switch", label: "form.includeLeadsLabel"},
                                }, "includeLeads", edit),
                            ],
                        },
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "scope"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 1},
                    children: [
                        chips("projects", "/api/realEstate/project/select", edit),
                        chips("units", "/api/realEstate/unit/select", edit),
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "contentOverrides"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 1},
                    children: [
                        field({
                            render: "#Field",
                            field: {
                                name: "subjectOverride",
                                widget: "#Input",
                                label: "form.subjectOverrideLabel",
                                placeholder: "form.subjectOverridePlaceholder",
                                widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                            },
                        }, "subjectOverride", edit),
                        field({
                            render: "#HtmlSourceEditor",
                            field: {
                                name: "bodyHtmlOverride",
                                widget: "#HtmlSourceEditor",
                                label: "form.bodyHtmlOverrideLabel",
                                widgetProps: {
                                    maxLength: AD_CAMPAIGN_BODY_MAX,
                                    placeholders: AD_CAMPAIGN_PLACEHOLDERS,
                                    previewApiUrl: "/api/realEstate/adCampaignTemplate/preview",
                                    campaignTypeField: "campaignType",
                                    subjectField: "subjectOverride",
                                    // A campaign has no locale of its own — it renders per
                                    // recipient — so the preview picks one to show.
                                    defaultLocale: "en-US",
                                    rows: 18,
                                    emptyMeansInherit: true,
                                },
                            },
                        }, "bodyHtmlOverride", edit),
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "delivery"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 3},
                    children: [
                        field({
                            render: "#Field",
                            field: {
                                name: "batchSize",
                                widget: "#Input",
                                label: "form.batchSizeLabel",
                                widgetProps: {
                                    type: "number",
                                    inputMode: "numeric",
                                    min: AD_CAMPAIGN_BATCH_SIZE_MIN,
                                    max: AD_CAMPAIGN_BATCH_SIZE_MAX,
                                },
                            },
                        }, "batchSize", edit),
                        field({
                            render: "#Field",
                            field: {
                                name: "fromName",
                                widget: "#Input",
                                label: "form.fromNameLabel",
                                placeholder: "form.fromNamePlaceholder",
                                widgetProps: {maxLength: 120},
                            },
                        }, "fromName", edit),
                        field({
                            render: "#Field",
                            field: {
                                name: "replyTo",
                                widget: "#Input",
                                label: "form.replyToLabel",
                                placeholder: "form.replyToPlaceholder",
                                widgetProps: {type: "email", autoComplete: "off"},
                            },
                        }, "replyTo", edit),
                    ],
                },
            ],
        },
    ];
}

export const adCampaignCreateFormView: ViewConfig = {
    model: "adcampaigns",
    viewType: "form",
    viewMode: "create",
    accessModel: "adcampaigns",
    apiUrl: "/api/realEstate/adCampaign",
    method: "PUT",
    nodes: formNodes(false),
};

export const adCampaignEditFormView: ViewConfig = {
    model: "adcampaigns",
    viewType: "form",
    viewMode: "edit",
    accessModel: "adcampaigns",
    apiUrl: "/api/realEstate/adCampaign",
    method: "PATCH",
    nodes: formNodes(true),
};

export const adCampaignViews: ViewConfig[] = [
    adCampaignSheetView,
    adCampaignCreateFormView,
    adCampaignEditFormView,
];
