import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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
                        {render: "#DisplayCard", permissions: {read: "project"}, dependent: "project", field: {name: "project.name", widget: "#DisplayCard", label: "project", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "edifice"}, dependent: "edifice", field: {name: "edifice.name", widget: "#DisplayCard", label: "edifice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "unit"}, dependent: "unit", field: {name: "unit.name", widget: "#DisplayCard", label: "unit", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "omManualsComplete"}, field: {name: "omManualsComplete", widget: "#DisplayCard", label: "omManualsComplete", widgetProps: {icon: "#BadgeCheck", valueType: "boolean"}}},
                        {render: "#DisplayCard", permissions: {read: "asBuiltComplete"}, field: {name: "asBuiltComplete", widget: "#DisplayCard", label: "asBuiltComplete", widgetProps: {icon: "#BadgeCheck", valueType: "boolean"}}},
                        {render: "#DisplayCard", permissions: {read: "keysTransferred"}, field: {name: "keysTransferred", widget: "#DisplayCard", label: "keysTransferred", widgetProps: {icon: "#BadgeCheck", valueType: "boolean"}}},
                        {render: "#DisplayCard", permissions: {read: "trainingComplete"}, field: {name: "trainingComplete", widget: "#DisplayCard", label: "trainingComplete", widgetProps: {icon: "#BadgeCheck", valueType: "boolean"}}},
                        {render: "#DisplayCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#DisplayCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                            field: {name: "media", widget: "#GalleryCarousel", widgetProps: {imageGalleryField: "media", showThumbnails: false, allowFullScreen: false, coverAfterFirst: true, showPreviews: true, previewLocation: "right"}},
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const formNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {render: "#Field", field: {name: "project", widget: "#ApiSelect", label: "form.projectLabel", placeholder: "form.projectPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "unit", widget: "#ApiSelect", label: "form.unitLabel", placeholder: "form.unitPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/unit/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "omManualsComplete", widget: "#Switch", label: "form.omManualsCompleteLabel"}},
                    {render: "#Field", field: {name: "asBuiltComplete", widget: "#Switch", label: "form.asBuiltCompleteLabel"}},
                    {render: "#Field", field: {name: "keysTransferred", widget: "#Switch", label: "form.keysTransferredLabel"}},
                    {render: "#Field", field: {name: "trainingComplete", widget: "#Switch", label: "form.trainingCompleteLabel"}},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
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
                        },
                    },
                ],
            },
        ],
    },
];

export const handoverPackageCreateFormView: ViewConfig = {
    model: "handoverpackages", viewType: "form", viewMode: "create", accessModel: "handoverpackages",
    apiUrl: "/api/realEstate/handoverPackage", method: "PUT", nodes: formNodes,
};

export const handoverPackageEditFormView: ViewConfig = {
    model: "handoverpackages", viewType: "form", viewMode: "edit", accessModel: "handoverpackages",
    apiUrl: "/api/realEstate/handoverPackage", method: "PATCH", nodes: formNodes,
};

export const handoverPackageViews: ViewConfig[] = [handoverPackageSheetView, handoverPackageCreateFormView, handoverPackageEditFormView];
