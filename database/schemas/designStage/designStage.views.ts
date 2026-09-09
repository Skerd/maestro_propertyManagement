import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const DESIGN_STAGE_TYPE_OPTIONS = [
    {value: "concept", label: "form.stageType_concept"},
    {value: "schematic", label: "form.stageType_schematic"},
    {value: "design_development", label: "form.stageType_design_development"},
    {value: "construction_documents", label: "form.stageType_construction_documents"},
    {value: "tender", label: "form.stageType_tender"},
    {value: "construction", label: "form.stageType_construction"},
    {value: "as_built", label: "form.stageType_as_built"},
] as const;

export const designStageSheetView: ViewConfig = {
    model: "designstages",
    viewType: "sheet",
    accessModel: "designstages",
    apiUrl: "/api/realEstate/designStage",
    header: {titleField: "title", subtitleKey: "designStage", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "title"}, field: {name: "title", widget: "#DisplayCard", label: "title", widgetProps: {icon: "#IconLabel"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "project"},
                            dependent: "project",
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
                            dependent: "edifice",
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
                            permissions: {read: "stageType"},
                            dependent: "stageType",
                            field: {
                                name: "stageType",
                                widget: "#DisplayCard",
                                label: "stageType",
                                widgetProps: {icon: "#IconLabel", languageKeyCategory: "stageTypes", type: "enum"},
                            },
                        },
                        {render: "#DisplayCard", permissions: {read: "sortOrder"}, dependent: "sortOrder", field: {name: "sortOrder", widget: "#DisplayCard", label: "sortOrder", widgetProps: {icon: "#IconLabel"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "status"},
                            field: {
                                name: "status",
                                widget: "#DisplayCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "statuses",
                                    variantLookupField: "status",
                                    variantLookupMap: {
                                        not_started: "secondary",
                                        in_progress: "info",
                                        completed: "success",
                                        blocked: "destructive",
                                    },
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "description"},
            dependent: "description",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "description"}, field: {name: "description", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "notes"},
            dependent: "notes",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "notes"}, field: {name: "notes", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const designStageCreateFormNodes: ViewConfig["nodes"] = [
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
                        props: {skipRenderWhenFormExtraTruthy: "prefilledProjectId"},
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
                                cascadeClearFormFields: ["edifice"],
                            },
                        },
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
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "stageType", widget: "#SimpleSelect", label: "form.stageTypeLabel", placeholder: "form.stageTypePlaceholder", required: true, widgetProps: {options: [...DESIGN_STAGE_TYPE_OPTIONS]}}},
                    {render: "#Field", field: {name: "sortOrder", widget: "#Input", label: "form.sortOrderLabel", placeholder: "form.sortOrderPlaceholder", widgetProps: {type: "number"}}},
                ],
            },
            {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
            {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
        ],
    },
];

const designStageEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {readAny: ["project", "edifice", "title", "stageType", "sortOrder", "description", "notes"], writeAny: ["project", "edifice", "title", "stageType", "sortOrder", "description", "notes"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        props: {skipRenderWhenFormExtraTruthy: "prefilledProjectId"},
                        field: {
                            name: "project",
                            widget: "#ApiSelect",
                            label: "form.projectLabel",
                            placeholder: "form.projectPlaceholder",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                cascadeClearFormFields: ["edifice"],
                            },
                        },
                        permissions: {read: "project"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "edifice",
                            widget: "#ApiSelect",
                            label: "form.edificeLabel",
                            placeholder: "form.edificePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/edifice/select",
                                method: "POST",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "edifice", write: "edifice"},
                    },
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}, permissions: {read: "title", write: "title"}},
                    {render: "#Field", field: {name: "stageType", widget: "#SimpleSelect", label: "form.stageTypeLabel", placeholder: "form.stageTypePlaceholder", required: true, widgetProps: {options: [...DESIGN_STAGE_TYPE_OPTIONS]}}, permissions: {read: "stageType", write: "stageType"}},
                    {render: "#Field", field: {name: "sortOrder", widget: "#Input", label: "form.sortOrderLabel", placeholder: "form.sortOrderPlaceholder", widgetProps: {type: "number"}}, permissions: {read: "sortOrder", write: "sortOrder"}},
                ],
            },
            {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "description", write: "description"}},
            {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "notes", write: "notes"}},
        ],
    },
];

export const designStageCreateFormView: ViewConfig = {
    model: "designstages", viewType: "form", viewMode: "create", accessModel: "designstages",
    apiUrl: "/api/realEstate/designStage", method: "PUT", nodes: designStageCreateFormNodes,
};

export const designStageEditFormView: ViewConfig = {
    model: "designstages", viewType: "form", viewMode: "edit", accessModel: "designstages",
    apiUrl: "/api/realEstate/designStage", method: "PATCH", nodes: designStageEditFormNodes,
};

export const designStageViews: ViewConfig[] = [designStageSheetView, designStageCreateFormView, designStageEditFormView];
