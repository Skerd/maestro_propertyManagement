import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    INSPECTION_CHECKLIST_ITEM_NAME_MAX,
    INSPECTION_CHECKLIST_ITEM_TEXT_MAX,
    INSPECTION_CHECKLIST_LONG_TEXT_MAX,
    INSPECTION_CHECKLIST_TITLE_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/inspectionChecklistTemplate/inspectionChecklistTemplate.schema-def";

const importanceOptions = [
    {value: "low", label: "form.importanceLow"},
    {value: "medium", label: "form.importanceMedium"},
    {value: "high", label: "form.importanceHigh"},
];

export const inspectionChecklistTemplateSheetView: ViewConfig = {
    model: "inspectionchecklisttemplates",
    viewType: "sheet",
    accessModel: "inspectionchecklisttemplates",
    apiUrl: "/api/realEstate/inspectionChecklistTemplate",
    header: {titleField: "title", subtitleKey: "inspectionChecklistTemplate", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "name"}, field: {name: "name", widget: "#DisplayCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "trade"}, dependent: "trade", field: {name: "trade", widget: "#DisplayCard", label: "trade", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "stage"}, dependent: "stage", field: {name: "stage", widget: "#DisplayCard", label: "stage", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "description"},
                            dependent: "description",
                            field: {
                                name: "description",
                                widget: "#DisplayCard",
                                label: "description",
                                widgetProps: {icon: "#IconAlignLeft", expandable: true, maxLength: 250},
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "notes"},
                            dependent: "notes",
                            field: {
                                name: "notes",
                                widget: "#DisplayCard",
                                label: "notes",
                                widgetProps: {icon: "#IconAlignLeft", expandable: true, maxLength: 250},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "inspectionChecklistTemplate.sheet.items.listDisplay",
                defaultMode: "cards",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: {readAny: ["items"]},
                    props: {
                        title: "checklist",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                            children: [
                                {
                                    render: "#SheetEmbeddedItemsList",
                                    permissions: {read: "items"},
                                    field: {
                                        name: "items",
                                        widget: "#SheetEmbeddedItemsList",
                                        widgetProps: {
                                            pageSize: 20,
                                            cardColumns: 3,
                                            compactSummaryFields: ["name", "importance"],
                                            fields: [
                                                {name: "name", type: "text", icon: "#IconLabel", labelKey: "itemName"},
                                                {name: "importance", type: "text", icon: "#CircleDot", labelKey: "importance", languageKeyCategory: "importanceLevels"},
                                                {name: "description", type: "expandableText", icon: "#IconAlignLeft", labelKey: "itemDescription"},
                                                {name: "instructions", type: "expandableText", icon: "#ClipboardList", labelKey: "itemInstructions"},
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const itemsRepeaterField = {
    name: "items",
    widget: "#FormRepeater",
    widgetProps: {
        title: "form.itemsSectionTitle",
        arrayField: "items",
        defaultItem: {name: "", description: "", instructions: "", importance: "medium"},
        addLabel: "form.itemAddRow",
        removeLabel: "form.itemRemoveRow",
        rowTitleFields: ["name"],
        rowTitlePlaceholder: "form.itemRowTitle",
        rowTemplate: [
            {
                render: "#FormGrid",
                props: {columns: 3, className: "items-start gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "div",
                        props: {className: "sm:col-span-2 md:col-span-2"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "name",
                                    widget: "#Input",
                                    label: "form.itemNameLabel",
                                    placeholder: "form.itemNamePlaceholder",
                                    required: true,
                                    widgetProps: {maxLength: INSPECTION_CHECKLIST_ITEM_NAME_MAX},
                                },
                            },
                        ],
                    },
                    {
                        render: "div",
                        props: {className: "sm:col-span-2 md:col-span-1"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "importance",
                                    widget: "#SimpleSelect",
                                    label: "form.importanceLabel",
                                    placeholder: "form.importancePlaceholder",
                                    widgetProps: {options: importanceOptions, className: "grow w-full"},
                                },
                            },
                        ],
                    },
                    {
                        render: "div",
                        props: {className: "sm:col-span-2 md:col-span-3 space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.itemDescriptionLabel",
                                    placeholder: "form.itemDescriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: INSPECTION_CHECKLIST_ITEM_TEXT_MAX,
                                    },
                                },
                            },
                        ],
                    },
                    {
                        render: "div",
                        props: {className: "sm:col-span-2 md:col-span-3 space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "instructions",
                                    widget: "#Textarea",
                                    label: "form.itemInstructionsLabel",
                                    placeholder: "form.itemInstructionsPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: INSPECTION_CHECKLIST_ITEM_TEXT_MAX,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

const createFormNodes: ViewConfig["nodes"] = [
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
                            widgetProps: {maxLength: INSPECTION_CHECKLIST_TITLE_MAX},
                        },
                    },
                    {render: "#Field", field: {name: "trade", widget: "#Input", label: "form.tradeLabel", placeholder: "form.tradePlaceholder"}},
                    {render: "#Field", field: {name: "stage", widget: "#Input", label: "form.stageLabel", placeholder: "form.stagePlaceholder"}},
                    {
                        render: "#FormGrid",
                        props: {columns: 1, className: "md:col-span-2 items-start gap-4"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: INSPECTION_CHECKLIST_LONG_TEXT_MAX},
                                },
                            },
                        ],
                    },
                    {
                        render: "#FormGrid",
                        props: {columns: 1, className: "md:col-span-2 items-start gap-4"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "notes",
                                    widget: "#Textarea",
                                    label: "form.notesLabel",
                                    placeholder: "form.notesPlaceholder",
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: INSPECTION_CHECKLIST_LONG_TEXT_MAX},
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {render: "#Field", field: itemsRepeaterField},
];

const editFormNodes: ViewConfig["nodes"] = [
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
                            widgetProps: {maxLength: INSPECTION_CHECKLIST_TITLE_MAX},
                        },
                        permissions: {read: "title", write: "title"},
                    },
                    {render: "#Field", field: {name: "trade", widget: "#Input", label: "form.tradeLabel", placeholder: "form.tradePlaceholder"}, permissions: {read: "trade", write: "trade"}},
                    {render: "#Field", field: {name: "stage", widget: "#Input", label: "form.stageLabel", placeholder: "form.stagePlaceholder"}, permissions: {read: "stage", write: "stage"}},
                    {
                        render: "#FormGrid",
                        props: {columns: 1, className: "md:col-span-2 items-start gap-4"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: INSPECTION_CHECKLIST_LONG_TEXT_MAX},
                                },
                                permissions: {read: "description", write: "description"},
                            },
                        ],
                    },
                    {
                        render: "#FormGrid",
                        props: {columns: 1, className: "md:col-span-2 items-start gap-4"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "notes",
                                    widget: "#Textarea",
                                    label: "form.notesLabel",
                                    placeholder: "form.notesPlaceholder",
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: INSPECTION_CHECKLIST_LONG_TEXT_MAX},
                                },
                                permissions: {read: "notes", write: "notes"},
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {render: "#Field", field: itemsRepeaterField, permissions: {read: "items", write: "items"}},
];

export const inspectionChecklistTemplateCreateFormView: ViewConfig = {
    model: "inspectionchecklisttemplates", viewType: "form", viewMode: "create", accessModel: "inspectionchecklisttemplates",
    apiUrl: "/api/realEstate/inspectionChecklistTemplate", method: "PUT", nodes: createFormNodes,
};

export const inspectionChecklistTemplateEditFormView: ViewConfig = {
    model: "inspectionchecklisttemplates", viewType: "form", viewMode: "edit", accessModel: "inspectionchecklisttemplates",
    apiUrl: "/api/realEstate/inspectionChecklistTemplate", method: "PATCH", nodes: editFormNodes,
};

export const inspectionChecklistTemplateViews: ViewConfig[] = [inspectionChecklistTemplateSheetView, inspectionChecklistTemplateCreateFormView, inspectionChecklistTemplateEditFormView];
