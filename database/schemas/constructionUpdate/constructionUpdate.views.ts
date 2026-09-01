import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    CONSTRUCTION_UPDATE_LONG_TEXT_MAX,
    CONSTRUCTION_UPDATE_SHORT_TEXT_MAX,
} from "armonia/src/modules/propertyManagement/api/realEstate/private/constructionUpdate/constructionUpdate.schema-def";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

export const constructionUpdateSheetView: ViewConfig = {
    model: "constructionupdates",
    viewType: "sheet",
    accessModel: "constructionupdates",
    apiUrl: "/api/realEstate/constructionUpdate",
    header: {
        titleField: "title",
        subtitleKey: "constructionUpdate",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            permissions: {
                readAny: [
                    "name",
                    "title",
                    "project",
                    "edifice",
                    "milestone",
                    "scheduleTask",
                    "progressPercent",
                    "updateDate",
                    "description",
                ],
            },
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: {icon: "#Tag"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "title"},
                            field: {
                                name: "title",
                                widget: "#DisplayCard",
                                label: "title",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "project"},
                            field: {
                                name: "project",
                                widget: "#DisplayCard",
                                label: "project",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "project",
                                    linkedSheetModel: "projects",
                                    linkedSheetWidget: "#ProjectSheetView",
                                    linkedSheetEntityProp: "project",
                                    parent: "project",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "edifice"},
                            field: {
                                name: "edifice",
                                widget: "#DisplayCard",
                                label: "edifice",
                                widgetProps: {
                                    icon: "#Building",
                                    linkedRefPath: "edifice",
                                    linkedSheetModel: "edifices",
                                    linkedSheetWidget: "#EdificeSheetView",
                                    linkedSheetEntityProp: "edifice",
                                    parent: "edifice",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "milestone"},
                            field: {
                                name: "milestone",
                                widget: "#DisplayCard",
                                label: "milestone",
                                widgetProps: {
                                    icon: "#Flag",
                                    linkedRefPath: "milestone",
                                    linkedSheetModel: "milestones",
                                    linkedSheetWidget: "#MilestoneSheetView",
                                    linkedSheetEntityProp: "milestone",
                                    parent: "milestone",
                                    valuePath: ["title", "name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "scheduleTask"},
                            field: {name: "scheduleTask", widget: "#DisplayCard", label: "scheduleTask", widgetProps: {icon: "#IconListDetailsFilled", linkedRefPath: "scheduleTask", linkedSheetModel: "scheduletasks", linkedSheetWidget: "#ScheduleTaskSheetView", linkedSheetEntityProp: "scheduleTask", parent: "scheduleTask", valuePath: ["title", "name", "_id"], pickFirstTruthyValuePath: true}},
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "progressPercent"},
                            field: {
                                name: "progressPercent",
                                widget: "#DisplayCard",
                                label: "progressPercent",
                                widgetProps: {icon: "#Percent", suffix: "%"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "updateDate"},
                            field: {name: "updateDate", widget: "#DisplayCard", label: "updateDate", widgetProps: {icon: "#IconCalendarBolt", format: "date", type: "date"}},
                        },
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
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            permissions: {readAny: ["photos"]},
            props: {title: "photos"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "photos"},
                            field: {
                                name: "photos",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "photos",
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

const constructionUpdateCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "gap-x-4 gap-y-5"},
                children: [
                    {
                        render: "#Field",
                        props: {skipRenderWhenFormExtraTruthy: "prefilledProjectId"},
                        field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, widgetProps: {apiUrl: "/api/realEstate/project/select", pageSize: 50, cascadeClearFormFields: ["edifice", "milestone", "scheduleTask"]}},
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
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "milestone",
                            widget: "#ApiSelect",
                            label: "form.milestoneLabel",
                            placeholder: "form.milestonePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/milestone/select",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "scheduleTask",
                            widget: "#ApiSelect",
                            label: "form.scheduleTaskLabel",
                            placeholder: "form.scheduleTaskPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/scheduleTask/select",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
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
                            widgetProps: {maxLength: CONSTRUCTION_UPDATE_SHORT_TEXT_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "progressPercent",
                            widget: "#Input",
                            label: "form.progressPercentLabel",
                            placeholder: "form.progressPercentPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 0, max: 100},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "updateDate",
                            widget: "#DateInput",
                            label: "form.updateDateLabel",
                            placeholder: "form.updateDatePlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: CONSTRUCTION_UPDATE_LONG_TEXT_MAX,
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
        render: "div",
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraNotTruthy: "enableLocalFileMultipart",
        },
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.photosLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {name: "photos", widget: "#FormMultiLocalFileField", widgetProps: {maxFiles: 20, accept: "image/*", existingListExtraKey: "editMediaExistingList", existingFilesLabelKey: "form.existingFiles", newFilesLabelKey: "form.newFiles"}},
                    },
                ],
            },
        ],
    },
];

const constructionUpdateEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {
            readAny: [
                "project",
                "edifice",
                "milestone",
                "scheduleTask",
                "title",
                "progressPercent",
                "updateDate",
                "description",
            ],
            writeAny: [
                "project",
                "edifice",
                "milestone",
                "scheduleTask",
                "title",
                "progressPercent",
                "updateDate",
                "description",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2, className: "gap-x-4 gap-y-5"},
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
                                pageSize: 50,
                                cascadeClearFormFields: ["edifice", "milestone", "scheduleTask"],
                            },
                        },
                        permissions: {read: "project", write: "project"},
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
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "edifice", write: "edifice"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "milestone",
                            widget: "#ApiSelect",
                            label: "form.milestoneLabel",
                            placeholder: "form.milestonePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/milestone/select",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "milestone", write: "milestone"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "scheduleTask",
                            widget: "#ApiSelect",
                            label: "form.scheduleTaskLabel",
                            placeholder: "form.scheduleTaskPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/scheduleTask/select",
                                pageSize: 50,
                                postBodyFromFormField: {field: "project", paramName: "project"},
                                remountKeyFormField: "project",
                                normalizeEmptyToUndefined: true,
                            },
                        },
                        permissions: {read: "scheduleTask", write: "scheduleTask"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "title",
                            widget: "#Input",
                            label: "form.titleLabel",
                            placeholder: "form.titlePlaceholder",
                            required: true,
                            widgetProps: {maxLength: CONSTRUCTION_UPDATE_SHORT_TEXT_MAX},
                        },
                        permissions: {read: "title", write: "title"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "progressPercent",
                            widget: "#Input",
                            label: "form.progressPercentLabel",
                            placeholder: "form.progressPercentPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 0, max: 100},
                        },
                        permissions: {read: "progressPercent", write: "progressPercent"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "updateDate",
                            widget: "#DateInput",
                            label: "form.updateDateLabel",
                            placeholder: "form.updateDatePlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                        permissions: {read: "updateDate", write: "updateDate"},
                    },
                    {
                        render: "div",
                        props: {className: "md:col-span-2 w-full space-y-1.5"},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "field-sizing-fixed min-h-[120px] resize-none max-h-[250px] overflow-y-auto",
                                        style: {maxHeight: 250},
                                        maxLength: CONSTRUCTION_UPDATE_LONG_TEXT_MAX,
                                    },
                                },
                                permissions: {read: "description", write: "description"},
                            },
                        ],
                    },
                ],
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
                props: {title: "form.photosLabel"},
                permissions: {readAny: ["photos"], writeAny: ["photos"]},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "photos",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 20,
                                accept: "image/*",
                                existingListExtraKey: "editMediaExistingList",
                                existingFilesLabelKey: "form.existingFiles",
                                newFilesLabelKey: "form.newFiles",
                            },
                        },
                        permissions: {read: "photos", write: "photos"},
                    },
                ],
            },
        ],
    },
];

export const constructionUpdateCreateFormView: ViewConfig = {
    model: "constructionupdates",
    viewType: "form",
    viewMode: "create",
    accessModel: "constructionupdates",
    apiUrl: "/api/realEstate/constructionUpdate",
    method: "PUT",
    nodes: constructionUpdateCreateFormNodes,
};

export const constructionUpdateEditFormView: ViewConfig = {
    model: "constructionupdates",
    viewType: "form",
    viewMode: "edit",
    accessModel: "constructionupdates",
    apiUrl: "/api/realEstate/constructionUpdate",
    method: "PATCH",
    nodes: constructionUpdateEditFormNodes,
};

export const constructionUpdateViews: ViewConfig[] = [
    constructionUpdateSheetView,
    constructionUpdateCreateFormView,
    constructionUpdateEditFormView,
];
