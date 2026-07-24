import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const consultantAppointmentSheetView: ViewConfig = {
    model: "consultantappointments",
    viewType: "sheet",
    accessModel: "consultantappointments",
    apiUrl: "/api/realEstate/consultantAppointment",
    header: {titleField: "title", subtitleKey: "consultantAppointment", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#SmallInfoCard", permissions: {read: "name"}, field: {name: "name", widget: "#SmallInfoCard", label: "name", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "project"}, dependent: "project", field: {name: "project.name", widget: "#SmallInfoCard", label: "project", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "constructorRef"}, dependent: "constructorRef", field: {name: "constructorRef.name", widget: "#SmallInfoCard", label: "constructorRef", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "role"}, dependent: "role", field: {name: "role", widget: "#SmallInfoCard", label: "role", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "scope"}, dependent: "scope", field: {name: "scope", widget: "#SmallInfoCard", label: "scope", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "currency"}, dependent: "currency", field: {name: "currency.abbreviation", widget: "#SmallInfoCard", label: "currency", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "feeAmount"}, dependent: "feeAmount", field: {name: "feeAmount", widget: "#SmallInfoCard", label: "feeAmount", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "startDate"}, dependent: "startDate", field: {name: "startDate", widget: "#SmallInfoCard", label: "startDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "endDate"}, dependent: "endDate", field: {name: "endDate", widget: "#SmallInfoCard", label: "endDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "deliverables"}, dependent: "deliverables", field: {name: "deliverables", widget: "#SmallInfoCard", label: "deliverables", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "status"}, field: {name: "status", widget: "#SmallInfoCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
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
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "role", widget: "#SimpleSelect", label: "form.roleLabel", placeholder: "form.rolePlaceholder", required: true, widgetProps: {options: [{value: "architect", label: "form.role_architect"}, {value: "engineer", label: "form.role_engineer"}, {value: "qs", label: "form.role_qs"}, {value: "pm", label: "form.role_pm"}, {value: "surveyor", label: "form.role_surveyor"}, {value: "other", label: "form.role_other"}]}}},
                    {render: "#Field", field: {name: "scope", widget: "#Textarea", label: "form.scopeLabel", placeholder: "form.scopePlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "feeAmount", widget: "#Input", label: "form.feeAmountLabel", placeholder: "form.feeAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "feeModel", widget: "#Select", label: "form.feeModelLabel", placeholder: "form.feeModelPlaceholder", widgetProps: {options: [{value: "sia_102", label: "SIA 102"}, {value: "sia_103", label: "SIA 103"}, {value: "sia_108", label: "SIA 108"}, {value: "lump_sum", label: "Lump sum"}, {value: "time_based", label: "Time based"}], className: "grow w-full"}}},
                    {render: "#Field", field: {name: "basisKind", widget: "#Select", label: "form.basisKindLabel", placeholder: "form.basisKindPlaceholder", widgetProps: {options: [{value: "construction_cost", label: "Construction cost"}, {value: "fixed", label: "Fixed"}, {value: "hourly", label: "Hourly"}], className: "grow w-full"}}},
                    {render: "#Field", field: {name: "adjustmentFactor", widget: "#Input", label: "form.adjustmentFactorLabel", placeholder: "form.adjustmentFactorPlaceholder", widgetProps: {type: "number", step: "0.01"}}},
                    {render: "#Field", field: {name: "hourlyRate", widget: "#Input", label: "form.hourlyRateLabel", placeholder: "form.hourlyRatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "cappedAmount", widget: "#Input", label: "form.cappedAmountLabel", placeholder: "form.cappedAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "startDate", widget: "#DateInput", label: "form.startDateLabel", placeholder: "form.startDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "endDate", widget: "#DateInput", label: "form.endDateLabel", placeholder: "form.endDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "deliverables", widget: "#Textarea", label: "form.deliverablesLabel", placeholder: "form.deliverablesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
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

export const consultantAppointmentCreateFormView: ViewConfig = {
    model: "consultantappointments", viewType: "form", viewMode: "create", accessModel: "consultantappointments",
    apiUrl: "/api/realEstate/consultantAppointment", method: "PUT", nodes: formNodes,
};

export const consultantAppointmentEditFormView: ViewConfig = {
    model: "consultantappointments", viewType: "form", viewMode: "edit", accessModel: "consultantappointments",
    apiUrl: "/api/realEstate/consultantAppointment", method: "PATCH", nodes: formNodes,
};

export const consultantAppointmentViews: ViewConfig[] = [consultantAppointmentSheetView, consultantAppointmentCreateFormView, consultantAppointmentEditFormView];
