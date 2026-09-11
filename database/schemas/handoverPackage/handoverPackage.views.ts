import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    HANDOVER_PACKAGE_ITEM_NAME_MAX,
    HANDOVER_PACKAGE_ITEM_TEXT_MAX,
    HANDOVER_PACKAGE_LONG_TEXT_MAX,
    HANDOVER_PACKAGE_TITLE_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/handoverPackage/handoverPackage.schema-def";

const importanceOptions = [
    {value: "low", label: "form.importanceLow"},
    {value: "medium", label: "form.importanceMedium"},
    {value: "high", label: "form.importanceHigh"},
];

export const handoverPackageSheetView: ViewConfig = {
    model: "handoverpackages",
    viewType: "sheet",
    accessModel: "handoverpackages",
    apiUrl: "/api/realEstate/handoverPackage",
    header: {titleField: "title", subtitleKey: "handoverPackage", showCloseButton: true},
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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "project"},
                            field: {
                                name: "project.name",
                                widget: "#DisplayCard",
                                label: "project",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "edifice"},
                            field: {
                                name: "edifice.name",
                                widget: "#DisplayCard",
                                label: "edifice",
                                widgetProps: {
                                    icon: "#Building",
                                    linkedRefPath: "edifice",
                                    linkedSheetModel: "edifices",
                                    linkedSheetWidget: "#EdificeSheetView",
                                    linkedSheetEntityProp: "edifice",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "floor"},
                            field: {
                                name: "floor.name",
                                widget: "#DisplayCard",
                                label: "floor",
                                widgetProps: {
                                    icon: "#Layers",
                                    linkedRefPath: "floor",
                                    linkedSheetModel: "floors",
                                    linkedSheetWidget: "#FloorSheetView",
                                    linkedSheetEntityProp: "floor",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "unit"},
                            field: {
                                name: "unit",
                                widget: "#DisplayCard",
                                label: "unit",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    linkedRefPath: "unit",
                                    linkedSheetModel: "units",
                                    linkedSheetWidget: "#UnitSheetView",
                                    linkedSheetEntityProp: "unit",
                                    parent: "unit",
                                    valuePath: ["name", "unitNumber", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {render: "#DisplayCard", field: {name: "scope", widget: "#DisplayCard", label: "scope", skipReadAccessGate: true, widgetProps: {icon: "#Layers", languageKeyCategory: "scopes"}}},
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "description"},
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
                storageKey: "handoverPackage.sheet.items.listDisplay",
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
        {
            render: "#SheetGroup",
            permissions: {readAny: ["media"]},
            props: {title: "media"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: {read: "media"},
                            field: {
                                name: "media",
                                widget: "#SheetMediaFilesStrip",
                                widgetProps: {
                                    canDownload: true,
                                    canRemove: false,
                                    isBig: false,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const handoverPackageCreateFormNode: ViewConfig["nodes"] = [
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
                        field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, cascadeClearFormFields: ["edifice", "floor", "unit"]}},
                    },
                    {
                        render: "#Field",
                        field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, postBodyFromFormField: {field: "project", paramName: "project"}, remountKeyFormField: "project", cascadeClearFormFields: ["floor", "unit"]}},
                    },
                    {
                        render: "#Field",
                        field: {name: "floor", widget: "#ApiSelect", label: "form.floorLabel", placeholder: "form.floorPlaceholder", widgetProps: {apiUrl: "/api/realEstate/floor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, postBodyFromFormField: {field: "edifice", paramName: "edifice"}, remountKeyFormField: "edifice", cascadeClearFormFields: ["unit"]}},
                    },
                    {
                        render: "#Field",
                        field: {name: "unit", widget: "#ApiSelect", label: "form.unitLabel", placeholder: "form.unitPlaceholder", widgetProps: {apiUrl: "/api/realEstate/unit/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, postBodyFromFormFields: [{field: "project", paramName: "project"}, {field: "edifice", paramName: "edifice"}, {field: "floor", paramName: "floor"}], enableWhenFormFieldsNonEmpty: ["project"], remountKeyFormField: "project"}},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: HANDOVER_PACKAGE_TITLE_MAX},
                        },
                    },
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
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: HANDOVER_PACKAGE_LONG_TEXT_MAX},
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
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: HANDOVER_PACKAGE_LONG_TEXT_MAX},
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#Field",
        field: {
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
                                            widgetProps: {maxLength: HANDOVER_PACKAGE_ITEM_NAME_MAX},
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
                                            widget: "#Select",
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
                                                maxLength: HANDOVER_PACKAGE_ITEM_TEXT_MAX,
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
                                                maxLength: HANDOVER_PACKAGE_ITEM_TEXT_MAX,
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    },
    {
        render: "div",
        props: {className: "col-span-full w-full", skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart"},
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.mediaLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {name: "media", widget: "#FormMultiLocalFileField", widgetProps: {maxFiles: 20, accept: "application/pdf,image/*", existingListExtraKey: "editMediaExistingList", existingFilesLabelKey: "form.existingFiles", newFilesLabelKey: "form.newFiles"}},
                    },
                ],
            },
        ],
    },
]

const handoverPackageEditFormNode: ViewConfig["nodes"] = [
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
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            required: true,
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                cascadeClearFormFields: ["edifice", "floor", "unit"],
                            },
                        }, permissions: {read: "project"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                cascadeClearFormFields: ["floor", "unit"],
                            },
                        }, permissions: {read: "edifice"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "floor",
                            widget: "#ApiSelect",
                            label: "form.floorLabel",
                            placeholder: "form.floorPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/floor/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBodyFromFormField: {field: "edifice", paramName: "edifice"},
                                remountKeyFormField: "edifice",
                                cascadeClearFormFields: ["unit"],
                            },
                        }, permissions: {read: "floor"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "unit",
                            widget: "#ApiSelect",
                            label: "form.unitLabel",
                            placeholder: "form.unitPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBodyFromFormFields: [
                                    {field: "project", paramName: "project"},
                                    {field: "edifice", paramName: "edifice"},
                                    {field: "floor", paramName: "floor"},
                                ],
                                enableWhenFormFieldsNonEmpty: ["project"],
                                remountKeyFormField: "project",
                            },
                        }, permissions: {read: "unit"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: HANDOVER_PACKAGE_TITLE_MAX},
                        }, permissions: {write: "title", read: "title"},
                    },
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
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: HANDOVER_PACKAGE_LONG_TEXT_MAX},
                                }, permissions: {write: "description", read: "description"},
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
                                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto", maxLength: HANDOVER_PACKAGE_LONG_TEXT_MAX},
                                }, permissions: {read: "notes", write: "notes"},
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#Field",
        field: {
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
                                            widgetProps: {maxLength: HANDOVER_PACKAGE_ITEM_NAME_MAX},
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
                                            widget: "#Select",
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
                                                maxLength: HANDOVER_PACKAGE_ITEM_TEXT_MAX,
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
                                                maxLength: HANDOVER_PACKAGE_ITEM_TEXT_MAX,
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        }, permissions: {read: "items", write: "items"},
    },
    {
        render: "div",
        props: {className: "col-span-full w-full", skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart"},
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.mediaLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "media",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 20,
                                accept: "application/pdf,image/*",
                                existingListExtraKey: "editMediaExistingList",
                                existingFilesLabelKey: "form.existingFiles",
                                newFilesLabelKey: "form.newFiles",
                            },
                        }, permissions: {read: "media", write: "media"},
                    },
                ],
            },
        ],
    },
];


export const handoverPackageCreateFormView: ViewConfig = {
    model: "handoverpackages",
    viewType: "form",
    viewMode: "create",
    accessModel: "handoverpackages",
    apiUrl: "/api/realEstate/handoverPackage",
    method: "PUT",
    nodes: handoverPackageCreateFormNode,
};

export const handoverPackageEditFormView: ViewConfig = {
    model: "handoverpackages",
    viewType: "form",
    viewMode: "edit",
    accessModel: "handoverpackages",
    apiUrl: "/api/realEstate/handoverPackage",
    method: "PATCH",
    nodes: handoverPackageEditFormNode,
};

export const handoverPackageViews: ViewConfig[] = [handoverPackageSheetView, handoverPackageCreateFormView, handoverPackageEditFormView];
