import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    AD_CAMPAIGN_BODY_MAX,
    AD_CAMPAIGN_LOCALE_VALUES,
    AD_CAMPAIGN_NAME_MAX,
    AD_CAMPAIGN_PLACEHOLDERS,
    AD_CAMPAIGN_SUBJECT_MAX,
    AD_CAMPAIGN_TYPE_VALUES,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/adCampaign/adCampaign.constants";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

type ViewNode = ViewConfig["nodes"][number];

const campaignTypeOptions = AD_CAMPAIGN_TYPE_VALUES.map(value => ({value, label: `form.campaignType.${value}`}));
const localeOptions = AD_CAMPAIGN_LOCALE_VALUES.map(value => ({value, label: `form.locale.${value}`}));

function card(name: string, widgetProps: Record<string, unknown>): ViewNode {
    return {
        render: "#DisplayCard",
        permissions: {read: name},
        field: {name, widget: "#DisplayCard", label: name, widgetProps},
    };
}

/** Adds edit-mode permissions to a field node; create forms carry none. */
function field(node: ViewNode, name: string, edit: boolean): ViewNode {
    return edit ? {...node, permissions: {read: name, write: name}} : node;
}

export const adCampaignTemplateSheetView: ViewConfig = {
    model: "adcampaigntemplates",
    viewType: "sheet",
    accessModel: "adcampaigntemplates",
    apiUrl: "/api/realEstate/adCampaignTemplate",
    header: {titleField: "name", subtitleKey: "adCampaignTemplate", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            permissions: {readAny: ["name", "campaignType", "locale", "subject", "previewText", "isDefault", "active"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        card("campaignType", {icon: "#Megaphone", languageKeyCategory: "campaignTypeEnum", type: "enum"}),
                        card("locale", {icon: "#Languages", languageKeyCategory: "localeEnum", type: "enum"}),
                        card("isDefault", {icon: "#Star", languageKeyCategory: "activeState", variantLookupField: "isDefault"}),
                        card("active", {icon: "#CircleDot", languageKeyCategory: "activeState", variantLookupField: "active"}),
                        card("subject", {icon: "#Mail"}),
                        card("previewText", {icon: "#Eye"}),
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
                                name: "name",
                                widget: "#Input",
                                label: "form.nameLabel",
                                placeholder: "form.namePlaceholder",
                                required: true,
                                widgetProps: {maxLength: AD_CAMPAIGN_NAME_MAX},
                            },
                        }, "name", edit),
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
                                name: "locale",
                                widget: "#SimpleSelect",
                                label: "form.localeLabel",
                                placeholder: "form.localePlaceholder",
                                required: true,
                                widgetProps: {options: localeOptions, className: "grow w-full"},
                            },
                        }, "locale", edit),
                        field({
                            render: "#Field",
                            field: {name: "isDefault", widget: "#Switch", label: "form.isDefaultLabel"},
                        }, "isDefault", edit),
                        field({
                            render: "#Field",
                            field: {name: "active", widget: "#Switch", label: "form.activeLabel"},
                        }, "active", edit),
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
                        field({
                            render: "#Field",
                            field: {
                                name: "subject",
                                widget: "#Input",
                                label: "form.subjectLabel",
                                placeholder: "form.subjectPlaceholder",
                                required: true,
                                widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                            },
                        }, "subject", edit),
                        field({
                            render: "#Field",
                            field: {
                                name: "previewText",
                                widget: "#Input",
                                label: "form.previewTextLabel",
                                placeholder: "form.previewTextPlaceholder",
                                widgetProps: {maxLength: AD_CAMPAIGN_SUBJECT_MAX},
                            },
                        }, "previewText", edit),
                        field({
                            render: "#HtmlSourceEditor",
                            field: {
                                name: "bodyHtml",
                                widget: "#HtmlSourceEditor",
                                label: "form.bodyHtmlLabel",
                                required: true,
                                widgetProps: {
                                    maxLength: AD_CAMPAIGN_BODY_MAX,
                                    // Drives the click-to-insert palette; the validator
                                    // rejects anything outside this same list.
                                    placeholders: AD_CAMPAIGN_PLACEHOLDERS,
                                    previewApiUrl: "/api/realEstate/adCampaignTemplate/preview",
                                    // Sibling fields the live preview renders with.
                                    campaignTypeField: "campaignType",
                                    localeField: "locale",
                                    subjectField: "subject",
                                    previewTextField: "previewText",
                                    rows: 22,
                                },
                            },
                        }, "bodyHtml", edit),
                    ],
                },
            ],
        },
    ];
}

export const adCampaignTemplateCreateFormView: ViewConfig = {
    model: "adcampaigntemplates",
    viewType: "form",
    viewMode: "create",
    accessModel: "adcampaigntemplates",
    apiUrl: "/api/realEstate/adCampaignTemplate",
    method: "PUT",
    nodes: formNodes(false),
};

export const adCampaignTemplateEditFormView: ViewConfig = {
    model: "adcampaigntemplates",
    viewType: "form",
    viewMode: "edit",
    accessModel: "adcampaigntemplates",
    apiUrl: "/api/realEstate/adCampaignTemplate",
    method: "PATCH",
    nodes: formNodes(true),
};

export const adCampaignTemplateViews: ViewConfig[] = [
    adCampaignTemplateSheetView,
    adCampaignTemplateCreateFormView,
    adCampaignTemplateEditFormView,
];
