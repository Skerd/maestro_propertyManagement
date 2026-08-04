import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const PROJECT_DOCUMENT_DISCIPLINE_OPTIONS = [
    {value: "architectural", label: "form.disciplineArchitectural"},
    {value: "structural",    label: "form.disciplineStructural"},
    {value: "mep",           label: "form.disciplineMep"},
    {value: "civil",         label: "form.disciplineCivil"},
    {value: "fire",          label: "form.disciplineFire"},
    {value: "landscape",     label: "form.disciplineLandscape"},
    {value: "other",         label: "form.disciplineOther"},
] as const;

const PROJECT_DOCUMENT_TYPE_OPTIONS = [
    {value: "drawing",       label: "form.documentTypeDrawing"},
    {value: "specification", label: "form.documentTypeSpecification"},
    {value: "calculation",   label: "form.documentTypeCalculation"},
    {value: "report",        label: "form.documentTypeReport"},
    {value: "as_built",      label: "form.documentTypeAsBuilt"},
    {value: "om_manual",     label: "form.documentTypeOmManual"},
    {value: "other",         label: "form.documentTypeOther"},
] as const;

export const projectDocumentSheetView: ViewConfig = {
    model: "projectdocuments",
    viewType: "sheet",
    accessModel: "projectdocuments",
    apiUrl: "/api/realEstate/projectDocument",
    header: {
        titleField: "title",
        subtitleKey: "projectDocument",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#SmallInfoCard",
                                label: "name",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "title"},
                            field: {
                                name: "title",
                                widget: "#SmallInfoCard",
                                label: "title",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "documentNumber"},
                            dependent: "documentNumber",
                            field: {
                                name: "documentNumber",
                                widget: "#SmallInfoCard",
                                label: "documentNumber",
                                widgetProps: {icon: "#IconHash"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "project"},
                            field: {
                                name: "project.name",
                                widget: "#SmallInfoCard",
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
                            render: "#SmallInfoCard",
                            permissions: {read: "edifice"},
                            dependent: "edifice",
                            field: {
                                name: "edifice.name",
                                widget: "#SmallInfoCard",
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
                            render: "#SmallInfoCard",
                            permissions: {read: "floor"},
                            dependent: "floor",
                            field: {
                                name: "floor.name",
                                widget: "#SmallInfoCard",
                                label: "floor",
                                widgetProps: {icon: "#Layers"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "unit"},
                            dependent: "unit",
                            field: {
                                name: "unit.name",
                                widget: "#SmallInfoCard",
                                label: "unit",
                                widgetProps: {
                                    icon: "#DoorOpen",
                                    linkedRefPath: "unit",
                                    linkedSheetModel: "units",
                                    linkedSheetWidget: "#UnitSheetView",
                                    linkedSheetEntityProp: "unit",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "discipline"},
                            field: {
                                name: "discipline",
                                widget: "#SmallInfoCard",
                                label: "discipline",
                                widgetProps: {icon: "#IconCategory", languageKeyCategory: "disciplines"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "documentType"},
                            field: {
                                name: "documentType",
                                widget: "#SmallInfoCard",
                                label: "documentType",
                                widgetProps: {icon: "#IconFileText", languageKeyCategory: "documentTypes"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "revision"},
                            dependent: "revision",
                            field: {
                                name: "revision",
                                widget: "#SmallInfoCard",
                                label: "revision",
                                widgetProps: {icon: "#IconGitBranch"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "revisionDate"},
                            dependent: "revisionDate",
                            field: {
                                name: "revisionDate",
                                widget: "#SmallInfoCard",
                                label: "revisionDate",
                                widgetProps: {icon: "#CalendarDays", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "status"},
                            field: {
                                name: "status",
                                widget: "#SmallInfoCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "statuses",
                                    variantLookupField: "status",
                                    variantLookupMap: {
                                        draft: "secondary",
                                        for_review: "warning",
                                        approved: "success",
                                        rejected: "destructive",
                                        superseded: "outline",
                                    },
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "isAsBuilt"},
                            field: {
                                name: "isAsBuilt",
                                widget: "#SmallInfoCard",
                                label: "isAsBuilt",
                                widgetProps: {icon: "#IconCircleCheck", valueType: "boolean"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "supersedes"},
                            dependent: "supersedes",
                            field: {
                                name: "supersedes.title",
                                widget: "#SmallInfoCard",
                                label: "supersedes",
                                widgetProps: {
                                    icon: "#IconHistory",
                                    linkedRefPath: "supersedes",
                                    linkedSheetModel: "projectdocuments",
                                    linkedSheetWidget: "#ProjectDocumentSheetView",
                                    linkedSheetEntityProp: "supersedes",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "designStage"},
                            dependent: "designStage",
                            field: {
                                name: "designStage.title",
                                widget: "#SmallInfoCard",
                                label: "designStage",
                                widgetProps: {icon: "#IconFolder"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "isRequiredDeliverable"},
                            field: {
                                name: "isRequiredDeliverable",
                                widget: "#SmallInfoCard",
                                label: "isRequiredDeliverable",
                                widgetProps: {icon: "#ShieldCheck", valueType: "boolean"},
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
                        {
                            render: "#ExpandableText",
                            permissions: {read: "description"},
                            field: {
                                name: "description",
                                widget: "#ExpandableText",
                                widgetProps: {className: "text-sm"},
                            },
                        },
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
                        {
                            render: "#ExpandableText",
                            permissions: {read: "notes"},
                            field: {
                                name: "notes",
                                widget: "#ExpandableText",
                                widgetProps: {className: "text-sm"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "media"},
            dependent: "media",
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "media"},
                            field: {
                                name: "media",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "media",
                                    showThumbnails: false,
                                    allowFullScreen: false,
                                    coverAfterFirst: true,
                                    showPreviews: true,
                                    previewLocation: "right",
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

const projectDocumentFormNodes: ViewConfig["nodes"] = [
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
                                formFieldName: "project",
                                cascadeClearFormFields: ["edifice", "floor", "unit"],
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
                                formFieldName: "edifice",
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                cascadeClearFormFields: ["floor", "unit"],
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
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
                                formFieldName: "floor",
                                postBodyFromFormField: {field: "edifice", paramName: "edifice"},
                                cascadeClearFormFields: ["unit"],
                                remountKeyFormField: "edifice",
                                normalizeEmptyToUndefined: true,
                            },
                        },
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
                                formFieldName: "unit",
                                postBodyFromFormFields: [
                                    {field: "edifice", paramName: "edifice"},
                                    {field: "floor", paramName: "floor"},
                                ],
                                remountKeyFormField: "floor",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "documentNumber",
                            widget: "#Input",
                            label: "form.documentNumberLabel",
                            placeholder: "form.documentNumberPlaceholder",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "discipline",
                            widget: "#SimpleSelect",
                            label: "form.disciplineLabel",
                            placeholder: "form.disciplinePlaceholder",
                            required: true,
                            widgetProps: {options: [...PROJECT_DOCUMENT_DISCIPLINE_OPTIONS]},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "documentType",
                            widget: "#SimpleSelect",
                            label: "form.documentTypeLabel",
                            placeholder: "form.documentTypePlaceholder",
                            required: true,
                            widgetProps: {options: [...PROJECT_DOCUMENT_TYPE_OPTIONS]},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "revision",
                            widget: "#Input",
                            label: "form.revisionLabel",
                            placeholder: "form.revisionPlaceholder",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "revisionDate",
                            widget: "#DateInput",
                            label: "form.revisionDateLabel",
                            placeholder: "form.revisionDatePlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "supersedes",
                            widget: "#ApiSelect",
                            label: "form.supersedesLabel",
                            placeholder: "form.supersedesPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/projectDocument/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "designStage",
                            widget: "#ApiSelect",
                            label: "form.designStageLabel",
                            placeholder: "form.designStagePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/designStage/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "isRequiredDeliverable",
                            widget: "#Checkbox",
                            label: "form.isRequiredDeliverableLabel",
                        },
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "description",
                    widget: "#Textarea",
                    label: "form.descriptionLabel",
                    placeholder: "form.descriptionPlaceholder",
                    widgetProps: {className: "resize-none max-h-[250px] overflow-y-auto"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"},
                },
            },
        ],
    },
    {
        render: "div",
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart",
        },
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
                        },
                    },
                ],
            },
        ],
    },
];

export const projectDocumentCreateFormView: ViewConfig = {
    model: "projectdocuments",
    viewType: "form",
    viewMode: "create",
    accessModel: "projectdocuments",
    apiUrl: "/api/realEstate/projectDocument",
    method: "PUT",
    nodes: projectDocumentFormNodes,
};

export const projectDocumentEditFormView: ViewConfig = {
    model: "projectdocuments",
    viewType: "form",
    viewMode: "edit",
    accessModel: "projectdocuments",
    apiUrl: "/api/realEstate/projectDocument",
    method: "PATCH",
    nodes: projectDocumentFormNodes,
};

export const projectDocumentViews: ViewConfig[] = [
    projectDocumentSheetView,
    projectDocumentCreateFormView,
    projectDocumentEditFormView,
];
