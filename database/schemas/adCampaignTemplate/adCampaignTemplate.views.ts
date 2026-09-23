import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {AD_CAMPAIGN_BODY_MAX, AD_CAMPAIGN_LOCALE_VALUES, AD_CAMPAIGN_NAME_MAX, AD_CAMPAIGN_PLACEHOLDERS, AD_CAMPAIGN_SUBJECT_MAX, AD_CAMPAIGN_TYPE_VALUES} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const campaignTypeOptions = AD_CAMPAIGN_TYPE_VALUES.map(value => ({value, label: `form.campaignType.${value}`}));
const localeOptions = AD_CAMPAIGN_LOCALE_VALUES.map(value => ({value, label: `form.locale.${value}`}));

export const adCampaignTemplateSheetView: ViewConfig = {
    model: "adcampaigntemplates",
    viewType: "sheet",
    accessModel: "adcampaigntemplates",
    apiUrl: "/api/realEstate/adCampaignTemplate",
    header: {
        titleField: "name",
        subtitleKey: "adCampaignTemplate",
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            permissions: {readAny: ["name", "campaignType", "locale", "subject", "previewText", "active"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {
                                read: "campaignType"
                            },
                            field: {
                                name: "campaignType",
                                widget: "#DisplayCard",
                                label: "campaignType",
                                widgetProps: {icon: "#Megaphone", languageKeyCategory: "campaignTypeEnum", type: "enum"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {
                                read: "locale"
                            },
                            field: {
                                name: "locale",
                                widget: "#DisplayCard",
                                label: "locale",
                                widgetProps: {icon: "#Languages", languageKeyCategory: "localeEnum", type: "enum"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {
                                read: "active"
                            },
                            field: {
                                name: "active",
                                widget: "#DisplayCard",
                                label: "active",
                                widgetProps: {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "active"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {
                                read: "subject"
                            },
                            field: {
                                name: "subject",
                                widget: "#DisplayCard",
                                label: "subject",
                                widgetProps: {icon: "#Mail"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {
                                read: "previewText"
                            },
                            field: {
                                name: "previewText",
                                widget: "#DisplayCard",
                                label: "previewText",
                                widgetProps: {icon: "#Eye"},
                            },
                        }
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "body"},
            permissions: {readAny: ["bodyHtml"]},
            children: [
                {
                    render: "#Field",
                    permissions: {read: "bodyHtml"},
                    // Read-only render of the stored markup, in the same sandboxed
                    // iframe the editor previews into — never injected into the panel DOM.
                    field: {
                        name: "bodyHtml",
                        widget: "#EmailHtmlPreview",
                        label: "bodyHtml",
                        widgetProps: {readOnly: true, height: 520},
                    },
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const createAdCampaignTemplateFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: {maxLength: AD_CAMPAIGN_NAME_MAX},
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
                            name: "locale",
                            widget: "#SimpleSelect",
                            label: "form.localeLabel",
                            placeholder: "form.localePlaceholder",
                            required: true,
                            widgetProps: {options: localeOptions, className: "grow w-full"},
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
                        render: "#Field",
                        field: {
                            name: "subject",
                            widget: "#Input",
                            label: "form.subjectLabel",
                            placeholder: "form.subjectPlaceholder",
                            required: true,
                            widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "previewText",
                            widget: "#Input",
                            label: "form.previewTextLabel",
                            placeholder: "form.previewTextPlaceholder",
                            widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                        },
                    },
                    {
                        render: "#HtmlSourceEditor",
                        field: {
                            name: "bodyHtml",
                            widget: "#HtmlSourceEditor",
                            label: "form.bodyHtmlLabel",
                            required: true,
                            widgetProps: {
                                maxLength: AD_CAMPAIGN_BODY_MAX,
                                placeholders: AD_CAMPAIGN_PLACEHOLDERS,
                                previewApiUrl: "/api/realEstate/adCampaignTemplate/preview",
                                campaignTypeField: "campaignType",
                                localeField: "locale",
                                subjectField: "subject",
                                previewTextField: "previewText",
                                rows: 22,
                            },
                        },
                    },
                ],
            },
        ],
    },
];

const editAdCampaignTemplateFormNode: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: {maxLength: AD_CAMPAIGN_NAME_MAX},
                        },
                        permissions: {
                            read: "name",
                            write: "name"
                        }
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
                        permissions: {
                            read: "campaignType",
                            write: "campaignType"
                        }
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "locale",
                            widget: "#SimpleSelect",
                            label: "form.localeLabel",
                            placeholder: "form.localePlaceholder",
                            required: true,
                            widgetProps: {options: localeOptions, className: "grow w-full"},
                        },
                        permissions: {
                            read: "locale",
                            write: "locale"
                        }
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
                        render: "#Field",
                        field: {
                            name: "subject",
                            widget: "#Input",
                            label: "form.subjectLabel",
                            placeholder: "form.subjectPlaceholder",
                            required: true,
                            widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                        },
                        permissions: {
                            read: "subject",
                            write: "subject"
                        }
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "previewText",
                            widget: "#Input",
                            label: "form.previewTextLabel",
                            placeholder: "form.previewTextPlaceholder",
                            widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                        },
                        permissions: {
                            read: "previewText",
                            write: "previewText"
                        }
                    },
                    {
                        render: "#HtmlSourceEditor",
                        field: {
                            name: "bodyHtml",
                            widget: "#HtmlSourceEditor",
                            label: "form.bodyHtmlLabel",
                            required: true,
                            widgetProps: {
                                maxLength: AD_CAMPAIGN_BODY_MAX,
                                placeholders: AD_CAMPAIGN_PLACEHOLDERS,
                                previewApiUrl: "/api/realEstate/adCampaignTemplate/preview",
                                campaignTypeField: "campaignType",
                                localeField: "locale",
                                subjectField: "subject",
                                previewTextField: "previewText",
                                rows: 22,
                            },
                        },
                        permissions: {
                            read: "bodyHtml",
                            write: "bodyHtml"
                        }
                    },
                ],
            },
        ],
    },
]

export const adCampaignTemplateCreateFormView: ViewConfig = {
    model: "adcampaigntemplates",
    viewType: "form",
    viewMode: "create",
    accessModel: "adcampaigntemplates",
    apiUrl: "/api/realEstate/adCampaignTemplate",
    method: "PUT",
    nodes: createAdCampaignTemplateFormNode,
};

export const adCampaignTemplateEditFormView: ViewConfig = {
    model: "adcampaigntemplates",
    viewType: "form",
    viewMode: "edit",
    accessModel: "adcampaigntemplates",
    apiUrl: "/api/realEstate/adCampaignTemplate",
    method: "PATCH",
    nodes: editAdCampaignTemplateFormNode,
};

export const adCampaignTemplateViews: ViewConfig[] = [adCampaignTemplateSheetView, adCampaignTemplateCreateFormView, adCampaignTemplateEditFormView];
