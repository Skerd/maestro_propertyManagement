import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    AD_CAMPAIGN_AUDIENCE_MODE_VALUES,
    AD_CAMPAIGN_BATCH_SIZE_MAX,
    AD_CAMPAIGN_BATCH_SIZE_MIN,
    AD_CAMPAIGN_BODY_MAX,
    AD_CAMPAIGN_CTA_URL_MAX,
    AD_CAMPAIGN_OFFER_TITLE_MAX,
    AD_CAMPAIGN_PLACEHOLDERS,
    AD_CAMPAIGN_SUBJECT_MAX,
    AD_CAMPAIGN_TITLE_MAX,
    AD_CAMPAIGN_TYPE_VALUES,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const campaignTypeOptions = AD_CAMPAIGN_TYPE_VALUES.map(value => ({value, label: `form.campaignType.${value}`}));
const audienceModeOptions = AD_CAMPAIGN_AUDIENCE_MODE_VALUES.map(value => ({value, label: `form.audienceMode.${value}`}));

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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "name"},
                            field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#Hash"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "campaignType"},
                            field: {name: "campaignType", widget: "#DisplayCard", label: "campaignType", widgetProps: {icon: "#Megaphone", languageKeyCategory: "campaignTypeEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "status"},
                            field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statusEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "template"},
                            field: {
                                name: "template",
                                widget: "#DisplayCard",
                                label: "template",
                                widgetProps: {
                                    icon: "#Mail",
                                    linkedRefPath: "template",
                                    parent: "template",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "scheduledAt"},
                            field: {name: "scheduledAt", widget: "#DisplayCard", label: "scheduledAt", widgetProps: {icon: "#IconCalendarBolt", format: "datetime", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "startedAt"},
                            field: {name: "startedAt", widget: "#DisplayCard", label: "startedAt", widgetProps: {icon: "#Play", format: "datetime", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "completedAt"},
                            field: {name: "completedAt", widget: "#DisplayCard", label: "completedAt", widgetProps: {icon: "#CircleCheck", format: "datetime", type: "date"}},
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "content"},
            permissions: {readAny: ["contentUnit", "contentProject", "offerTitle", "offerEndsAt", "ctaUrl", "subjectOverride", "bodyHtmlOverride", "fromName", "replyTo"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "contentUnit"},
                            field: {
                                name: "contentUnit",
                                widget: "#DisplayCard",
                                label: "contentUnit",
                                widgetProps: {
                                    icon: "#Home",
                                    linkedRefPath: "contentUnit",
                                    parent: "contentUnit",
                                    valuePath: ["name", "unitNumber", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "contentProject"},
                            field: {
                                name: "contentProject",
                                widget: "#DisplayCard",
                                label: "contentProject",
                                widgetProps: {
                                    icon: "#Building",
                                    linkedRefPath: "contentProject",
                                    parent: "contentProject",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "offerTitle"},
                            field: {name: "offerTitle", widget: "#DisplayCard", label: "offerTitle", widgetProps: {icon: "#Tag"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "offerEndsAt"},
                            field: {name: "offerEndsAt", widget: "#DisplayCard", label: "offerEndsAt", widgetProps: {icon: "#IconCalendarBolt", format: "datetime", type: "date"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "ctaUrl"},
                            field: {name: "ctaUrl", widget: "#DisplayCard", label: "ctaUrl", widgetProps: {icon: "#Link"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "fromName"},
                            field: {name: "fromName", widget: "#DisplayCard", label: "fromName", widgetProps: {icon: "#User"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "replyTo"},
                            field: {name: "replyTo", widget: "#DisplayCard", label: "replyTo", widgetProps: {icon: "#Mail"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "subjectOverride"},
                            field: {name: "subjectOverride", widget: "#DisplayCard", label: "subjectOverride", widgetProps: {icon: "#Type"}},
                        },
                    ],
                },
                {
                    render: "#Field",
                    permissions: {read: "bodyHtmlOverride"},
                    field: {
                        name: "bodyHtmlOverride",
                        widget: "#EmailHtmlPreview",
                        label: "bodyHtmlOverride",
                        widgetProps: {readOnly: true, height: 420},
                    },
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "audience"},
            permissions: {readAny: ["audienceMode", "includeClientUsers", "includeLeads"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "audienceMode"},
                            field: {name: "audienceMode", widget: "#DisplayCard", label: "audienceMode", widgetProps: {icon: "#Users", languageKeyCategory: "audienceModeEnum", type: "enum"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "includeClientUsers"},
                            field: {name: "includeClientUsers", widget: "#DisplayCard", label: "includeClientUsers", widgetProps: {icon: "#User", type: "boolean"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "includeLeads"},
                            field: {name: "includeLeads", widget: "#DisplayCard", label: "includeLeads", widgetProps: {icon: "#Users", type: "boolean"}},
                        },
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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "stats.total"},
                            field: {name: "stats.total", widget: "#DisplayCard", label: "stats.total", widgetProps: {icon: "#Users", label: "stats.total"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "stats.sent"},
                            field: {name: "stats.sent", widget: "#DisplayCard", label: "stats.sent", widgetProps: {icon: "#Send", label: "stats.sent"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "stats.pending"},
                            field: {name: "stats.pending", widget: "#DisplayCard", label: "stats.pending", widgetProps: {icon: "#Clock", label: "stats.pending"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "stats.failed"},
                            field: {name: "stats.failed", widget: "#DisplayCard", label: "stats.failed", widgetProps: {icon: "#TriangleAlert", label: "stats.failed"}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "stats.skipped"},
                            field: {name: "stats.skipped", widget: "#DisplayCard", label: "stats.skipped", widgetProps: {icon: "#CircleSlash", label: "stats.skipped"}},
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

const adCampaignCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: AD_CAMPAIGN_TITLE_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "campaignType",
                            widget: "#SimpleSelect",
                            label: "form.campaignTypeLabel",
                            placeholder: "form.campaignTypePlaceholder",
                            required: true,
                            widgetProps: {options: campaignTypeOptions, className: "grow w-full"},
                        },
                    },
                    {
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
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "scheduledAt",
                            widget: "#DateInput",
                            label: "form.scheduledAtLabel",
                            placeholder: "form.scheduledAtPlaceholder",
                            widgetProps: {withTime: true},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "content"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {
                            watchField: "campaignType",
                            whenValues: ["price_change"],
                            clearFields: ["offerTitle", "offerEndsAt"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "contentUnit",
                                    widget: "#ApiSelect",
                                    label: "form.contentUnitLabel",
                                    placeholder: "form.contentUnitPlaceholder",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/unit/select",
                                        method: "POST",
                                        className: "grow w-full",
                                    },
                                },
                            },
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {
                            watchField: "campaignType",
                            whenValues: ["offer"],
                            clearFields: ["contentUnit"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "offerTitle",
                                    widget: "#Input",
                                    label: "form.offerTitleLabel",
                                    placeholder: "form.offerTitlePlaceholder",
                                    required: true,
                                    widgetProps: {maxLength: AD_CAMPAIGN_OFFER_TITLE_MAX},
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "offerEndsAt",
                                    widget: "#DateInput",
                                    label: "form.offerEndsAtLabel",
                                    placeholder: "form.offerEndsAtPlaceholder",
                                    required: true,
                                    widgetProps: {withTime: true},
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "contentProject",
                                    widget: "#ApiSelect",
                                    label: "form.contentProjectLabel",
                                    placeholder: "form.contentProjectPlaceholder",
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/project/select",
                                        method: "POST",
                                        className: "grow w-full",
                                    },
                                },
                            },
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {
                            watchField: "campaignType",
                            whenValues: ["new_project"],
                            clearFields: ["contentUnit", "offerTitle", "offerEndsAt"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "contentProject",
                                    widget: "#ApiSelect",
                                    label: "form.contentProjectLabel",
                                    placeholder: "form.contentProjectPlaceholder",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/project/select",
                                        method: "POST",
                                        className: "grow w-full",
                                    },
                                },
                            },
                        ],
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "ctaUrl",
                            widget: "#Input",
                            label: "form.ctaUrlLabel",
                            placeholder: "form.ctaUrlPlaceholder",
                            widgetProps: {type: "url", maxLength: AD_CAMPAIGN_CTA_URL_MAX},
                        },
                    },
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
                    {
                        render: "#Field",
                        field: {
                            name: "audienceMode",
                            widget: "#SimpleSelect",
                            label: "form.audienceModeLabel",
                            placeholder: "form.audienceModePlaceholder",
                            required: true,
                            widgetProps: {options: audienceModeOptions, className: "grow w-full"},
                        },
                    },
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
                            {
                                render: "#Field",
                                field: {
                                    name: "recipients",
                                    widget: "#ObjectIdChipsInput",
                                    label: "form.recipientsLabel",
                                    widgetProps: {
                                        apiUrl: "/api/company/users/select",
                                        method: "POST",
                                        placeholderKey: "form.selectRecipients",
                                        removeTooltipKey: "form.removeItem",
                                        selectPageSizeCreate: 50,
                                        selectPageSizeEdit: 200,
                                        labelRefFormExtraKey: "recipients",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "leadRecipients",
                                    widget: "#ObjectIdChipsInput",
                                    label: "form.leadRecipientsLabel",
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/lead/select",
                                        method: "POST",
                                        placeholderKey: "form.selectLeadRecipients",
                                        removeTooltipKey: "form.removeItem",
                                        selectPageSizeCreate: 50,
                                        selectPageSizeEdit: 200,
                                        labelRefFormExtraKey: "leadRecipients",
                                    },
                                },
                            },
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
                            {
                                render: "#Field",
                                field: {name: "includeClientUsers", widget: "#Switch", label: "form.includeClientUsersLabel"},
                            },
                            {
                                render: "#Field",
                                field: {name: "includeLeads", widget: "#Switch", label: "form.includeLeadsLabel"},
                            },
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
                    {
                        render: "#Field",
                        field: {
                            name: "projects",
                            widget: "#ObjectIdChipsInput",
                            label: "form.projectsLabel",
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                placeholderKey: "form.selectProjects",
                                removeTooltipKey: "form.removeItem",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "projects",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "units",
                            widget: "#ObjectIdChipsInput",
                            label: "form.unitsLabel",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                placeholderKey: "form.selectUnits",
                                removeTooltipKey: "form.removeItem",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "units",
                            },
                        },
                    },
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
                    {
                        render: "#Field",
                        field: {
                            name: "subjectOverride",
                            widget: "#Input",
                            label: "form.subjectOverrideLabel",
                            placeholder: "form.subjectOverridePlaceholder",
                            widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                        },
                    },
                    {
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
                    },
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
                    {
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
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "fromName",
                            widget: "#Input",
                            label: "form.fromNameLabel",
                            placeholder: "form.fromNamePlaceholder",
                            widgetProps: {maxLength: 120},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "replyTo",
                            widget: "#Input",
                            label: "form.replyToLabel",
                            placeholder: "form.replyToPlaceholder",
                            widgetProps: {type: "email", autoComplete: "off"},
                        },
                    },
                ],
            },
        ],
    },
];

const adCampaignEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: AD_CAMPAIGN_TITLE_MAX},
                        },
                        permissions: {read: "title", write: "title"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "campaignType",
                            widget: "#SimpleSelect",
                            label: "form.campaignTypeLabel",
                            placeholder: "form.campaignTypePlaceholder",
                            required: true,
                            widgetProps: {options: campaignTypeOptions, className: "grow w-full"},
                        },
                        permissions: {read: "campaignType", write: "campaignType"},
                    },
                    {
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
                        permissions: {read: "template", write: "template"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "scheduledAt",
                            widget: "#DateInput",
                            label: "form.scheduledAtLabel",
                            placeholder: "form.scheduledAtPlaceholder",
                            widgetProps: {withTime: true},
                        },
                        permissions: {read: "scheduledAt", write: "scheduledAt"},
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "content"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: [
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {
                            watchField: "campaignType",
                            whenValues: ["price_change"],
                            clearFields: ["offerTitle", "offerEndsAt"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "contentUnit",
                                    widget: "#ApiSelect",
                                    label: "form.contentUnitLabel",
                                    placeholder: "form.contentUnitPlaceholder",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/unit/select",
                                        method: "POST",
                                        className: "grow w-full",
                                    },
                                },
                                permissions: {read: "contentUnit", write: "contentUnit"},
                            },
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {
                            watchField: "campaignType",
                            whenValues: ["offer"],
                            clearFields: ["contentUnit"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "offerTitle",
                                    widget: "#Input",
                                    label: "form.offerTitleLabel",
                                    placeholder: "form.offerTitlePlaceholder",
                                    required: true,
                                    widgetProps: {maxLength: AD_CAMPAIGN_OFFER_TITLE_MAX},
                                },
                                permissions: {read: "offerTitle", write: "offerTitle"},
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "offerEndsAt",
                                    widget: "#DateInput",
                                    label: "form.offerEndsAtLabel",
                                    placeholder: "form.offerEndsAtPlaceholder",
                                    required: true,
                                    widgetProps: {withTime: true},
                                },
                                permissions: {read: "offerEndsAt", write: "offerEndsAt"},
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "contentProject",
                                    widget: "#ApiSelect",
                                    label: "form.contentProjectLabel",
                                    placeholder: "form.contentProjectPlaceholder",
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/project/select",
                                        method: "POST",
                                        className: "grow w-full",
                                    },
                                },
                                permissions: {read: "contentProject", write: "contentProject"},
                            },
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {
                            watchField: "campaignType",
                            whenValues: ["new_project"],
                            clearFields: ["contentUnit", "offerTitle", "offerEndsAt"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "contentProject",
                                    widget: "#ApiSelect",
                                    label: "form.contentProjectLabel",
                                    placeholder: "form.contentProjectPlaceholder",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/project/select",
                                        method: "POST",
                                        className: "grow w-full",
                                    },
                                },
                                permissions: {read: "contentProject", write: "contentProject"},
                            },
                        ],
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "ctaUrl",
                            widget: "#Input",
                            label: "form.ctaUrlLabel",
                            placeholder: "form.ctaUrlPlaceholder",
                            widgetProps: {type: "url", maxLength: AD_CAMPAIGN_CTA_URL_MAX},
                        },
                        permissions: {read: "ctaUrl", write: "ctaUrl"},
                    },
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
                    {
                        render: "#Field",
                        field: {
                            name: "audienceMode",
                            widget: "#SimpleSelect",
                            label: "form.audienceModeLabel",
                            placeholder: "form.audienceModePlaceholder",
                            required: true,
                            widgetProps: {options: audienceModeOptions, className: "grow w-full"},
                        },
                        permissions: {read: "audienceMode", write: "audienceMode"},
                    },
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
                            {
                                render: "#Field",
                                field: {
                                    name: "recipients",
                                    widget: "#ObjectIdChipsInput",
                                    label: "form.recipientsLabel",
                                    widgetProps: {
                                        apiUrl: "/api/company/users/select",
                                        method: "POST",
                                        placeholderKey: "form.selectRecipients",
                                        removeTooltipKey: "form.removeItem",
                                        selectPageSizeCreate: 50,
                                        selectPageSizeEdit: 200,
                                        labelRefFormExtraKey: "recipients",
                                    },
                                },
                                permissions: {read: "recipients", write: "recipients"},
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "leadRecipients",
                                    widget: "#ObjectIdChipsInput",
                                    label: "form.leadRecipientsLabel",
                                    widgetProps: {
                                        apiUrl: "/api/realEstate/lead/select",
                                        method: "POST",
                                        placeholderKey: "form.selectLeadRecipients",
                                        removeTooltipKey: "form.removeItem",
                                        selectPageSizeCreate: 50,
                                        selectPageSizeEdit: 200,
                                        labelRefFormExtraKey: "leadRecipients",
                                    },
                                },
                                permissions: {read: "leadRecipients", write: "leadRecipients"},
                            },
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
                            {
                                render: "#Field",
                                field: {name: "includeClientUsers", widget: "#Switch", label: "form.includeClientUsersLabel"},
                                permissions: {read: "includeClientUsers", write: "includeClientUsers"},
                            },
                            {
                                render: "#Field",
                                field: {name: "includeLeads", widget: "#Switch", label: "form.includeLeadsLabel"},
                                permissions: {read: "includeLeads", write: "includeLeads"},
                            },
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
                    {
                        render: "#Field",
                        field: {
                            name: "projects",
                            widget: "#ObjectIdChipsInput",
                            label: "form.projectsLabel",
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                placeholderKey: "form.selectProjects",
                                removeTooltipKey: "form.removeItem",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "projects",
                            },
                        },
                        permissions: {read: "projects", write: "projects"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "units",
                            widget: "#ObjectIdChipsInput",
                            label: "form.unitsLabel",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                placeholderKey: "form.selectUnits",
                                removeTooltipKey: "form.removeItem",
                                selectPageSizeCreate: 50,
                                selectPageSizeEdit: 200,
                                labelRefFormExtraKey: "units",
                            },
                        },
                        permissions: {read: "units", write: "units"},
                    },
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
                    {
                        render: "#Field",
                        field: {
                            name: "subjectOverride",
                            widget: "#Input",
                            label: "form.subjectOverrideLabel",
                            placeholder: "form.subjectOverridePlaceholder",
                            widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                        },
                        permissions: {read: "subjectOverride", write: "subjectOverride"},
                    },
                    {
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
                        permissions: {read: "bodyHtmlOverride", write: "bodyHtmlOverride"},
                    },
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
                    {
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
                        permissions: {read: "batchSize", write: "batchSize"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "fromName",
                            widget: "#Input",
                            label: "form.fromNameLabel",
                            placeholder: "form.fromNamePlaceholder",
                            widgetProps: {maxLength: 120},
                        },
                        permissions: {read: "fromName", write: "fromName"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "replyTo",
                            widget: "#Input",
                            label: "form.replyToLabel",
                            placeholder: "form.replyToPlaceholder",
                            widgetProps: {type: "email", autoComplete: "off"},
                        },
                        permissions: {read: "replyTo", write: "replyTo"},
                    },
                ],
            },
        ],
    },
];

export const adCampaignCreateFormView: ViewConfig = {
    model: "adcampaigns",
    viewType: "form",
    viewMode: "create",
    accessModel: "adcampaigns",
    apiUrl: "/api/realEstate/adCampaign",
    method: "PUT",
    nodes: adCampaignCreateFormNodes,
};

export const adCampaignEditFormView: ViewConfig = {
    model: "adcampaigns",
    viewType: "form",
    viewMode: "edit",
    accessModel: "adcampaigns",
    apiUrl: "/api/realEstate/adCampaign",
    method: "PATCH",
    nodes: adCampaignEditFormNodes,
};

export const adCampaignViews: ViewConfig[] = [
    adCampaignSheetView,
    adCampaignCreateFormView,
    adCampaignEditFormView,
];
