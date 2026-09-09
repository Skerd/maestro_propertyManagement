import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const CONSULTANT_ROLE_OPTIONS = [
    {value: "architect", label: "form.role_architect"},
    {value: "engineer", label: "form.role_engineer"},
    {value: "qs", label: "form.role_qs"},
    {value: "pm", label: "form.role_pm"},
    {value: "surveyor", label: "form.role_surveyor"},
    {value: "other", label: "form.role_other"},
] as const;

const CONSULTANT_FEE_MODEL_OPTIONS = [
    {value: "sia_102", label: "form.feeModel_sia_102"},
    {value: "sia_103", label: "form.feeModel_sia_103"},
    {value: "sia_108", label: "form.feeModel_sia_108"},
    {value: "lump_sum", label: "form.feeModel_lump_sum"},
    {value: "time_based", label: "form.feeModel_time_based"},
] as const;

const CONSULTANT_BASIS_KIND_OPTIONS = [
    {value: "construction_cost", label: "form.basisKind_construction_cost"},
    {value: "fixed", label: "form.basisKind_fixed"},
    {value: "hourly", label: "form.basisKind_hourly"},
] as const;

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
                            permissions: {read: "constructorRef"},
                            dependent: "constructorRef",
                            field: {
                                name: "constructorRef.name",
                                widget: "#DisplayCard",
                                label: "constructorRef",
                                widgetProps: {
                                    icon: "#IconBuilding",
                                    linkedRefPath: "constructorRef",
                                    linkedSheetModel: "constructors",
                                    linkedSheetWidget: "#ConstructorSheetView",
                                    linkedSheetEntityProp: "constructor",
                                },
                            },
                        },
                        {render: "#DisplayCard", permissions: {read: "role"}, dependent: "role", field: {name: "role", widget: "#DisplayCard", label: "role", widgetProps: {icon: "#IconLabel", languageKeyCategory: "roles", type: "enum"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "currency"},
                            dependent: "currency",
                            field: {
                                name: "currency.name",
                                widget: "#DisplayCard",
                                label: "currency",
                                widgetProps: {
                                    icon: "#DollarSign",
                                    valuePath: ["currency.symbol", "currency.name"],
                                    joinSeparator: " ",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "feeAmount"},
                            dependent: "feeAmount",
                            field: {
                                name: "feeAmount",
                                widget: "#DisplayCard",
                                label: "feeAmount",
                                widgetProps: {icon: "#Tag", format: "locale", valuePath: ["currency.symbol", "feeAmount"], joinSeparator: " ", type: "currency"},
                            },
                        },
                        {render: "#DisplayCard", permissions: {read: "feeModel"}, dependent: "feeModel", field: {name: "feeModel", widget: "#DisplayCard", label: "feeModel", widgetProps: {icon: "#IconLabel", languageKeyCategory: "feeModels", type: "enum"}}},
                        {render: "#DisplayCard", permissions: {read: "basisKind"}, dependent: "basisKind", field: {name: "basisKind", widget: "#DisplayCard", label: "basisKind", widgetProps: {icon: "#IconLabel", languageKeyCategory: "basisKinds", type: "enum"}}},
                        {render: "#DisplayCard", permissions: {read: "adjustmentFactor"}, dependent: "adjustmentFactor", field: {name: "adjustmentFactor", widget: "#DisplayCard", label: "adjustmentFactor", widgetProps: {icon: "#Percent"}}},
                        {
                            render: "#DisplayCard",
                            permissions: {read: "hourlyRate"},
                            dependent: "hourlyRate",
                            field: {
                                name: "hourlyRate",
                                widget: "#DisplayCard",
                                label: "hourlyRate",
                                widgetProps: {icon: "#Tag", format: "locale", valuePath: ["currency.symbol", "hourlyRate"], joinSeparator: " ", type: "currency"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "cappedAmount"},
                            dependent: "cappedAmount",
                            field: {
                                name: "cappedAmount",
                                widget: "#DisplayCard",
                                label: "cappedAmount",
                                widgetProps: {icon: "#Tag", format: "locale", valuePath: ["currency.symbol", "cappedAmount"], joinSeparator: " ", type: "currency"},
                            },
                        },
                        {render: "#DisplayCard", permissions: {read: "startDate"}, dependent: "startDate", field: {name: "startDate", widget: "#DisplayCard", label: "startDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#DisplayCard", permissions: {read: "endDate"}, dependent: "endDate", field: {name: "endDate", widget: "#DisplayCard", label: "endDate", widgetProps: {icon: "#CalendarDays", format: "date"}}},
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
                                        draft: "secondary",
                                        active: "info",
                                        completed: "success",
                                        terminated: "destructive",
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
            props: {title: "scope"},
            dependent: "scope",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "scope"}, field: {name: "scope", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "deliverables"},
            dependent: "deliverables",
            children: [
                {
                    render: "div",
                    props: {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {render: "#ExpandableText", permissions: {read: "deliverables"}, field: {name: "deliverables", widget: "#ExpandableText", widgetProps: {className: "text-sm"}}},
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

const consultantAppointmentCreateFormNodes: ViewConfig["nodes"] = [
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
                            widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true},
                        },
                    },
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", required: true, skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}},
                    {render: "#Field", field: {name: "role", widget: "#SimpleSelect", label: "form.roleLabel", placeholder: "form.rolePlaceholder", required: true, widgetProps: {options: [...CONSULTANT_ROLE_OPTIONS]}}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "feeAmount", widget: "#Input", label: "form.feeAmountLabel", placeholder: "form.feeAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                    {render: "#Field", field: {name: "feeModel", widget: "#SimpleSelect", label: "form.feeModelLabel", placeholder: "form.feeModelPlaceholder", widgetProps: {options: [...CONSULTANT_FEE_MODEL_OPTIONS]}}},
                    {render: "#Field", field: {name: "basisKind", widget: "#SimpleSelect", label: "form.basisKindLabel", placeholder: "form.basisKindPlaceholder", widgetProps: {options: [...CONSULTANT_BASIS_KIND_OPTIONS]}}},
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {watchField: "feeModel", whenValues: ["sia_102", "sia_103", "sia_108"], clearFields: ["adjustmentFactor"]},
                        children: [
                            {render: "#Field", field: {name: "adjustmentFactor", widget: "#Input", label: "form.adjustmentFactorLabel", placeholder: "form.adjustmentFactorPlaceholder", widgetProps: {type: "number", step: "0.01"}}},
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {watchField: "feeModel", whenValues: ["time_based"], clearFields: ["hourlyRate"]},
                        children: [
                            {render: "#Field", field: {name: "hourlyRate", widget: "#Input", label: "form.hourlyRateLabel", placeholder: "form.hourlyRatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        props: {watchField: "feeModel", whenValues: ["time_based", "lump_sum"], clearFields: ["cappedAmount"]},
                        children: [
                            {render: "#Field", field: {name: "cappedAmount", widget: "#Input", label: "form.cappedAmountLabel", placeholder: "form.cappedAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                        ],
                    },
                    {render: "#Field", field: {name: "startDate", widget: "#DateInput", label: "form.startDateLabel", placeholder: "form.startDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "endDate", widget: "#DateInput", label: "form.endDateLabel", placeholder: "form.endDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                ],
            },
            {render: "#Field", field: {name: "scope", widget: "#Textarea", label: "form.scopeLabel", placeholder: "form.scopePlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
            {render: "#Field", field: {name: "deliverables", widget: "#Textarea", label: "form.deliverablesLabel", placeholder: "form.deliverablesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
            {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
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

const consultantAppointmentEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {
            readAny: ["project", "constructorRef", "title", "role", "scope", "currency", "feeAmount", "feeModel", "basisKind", "adjustmentFactor", "hourlyRate", "cappedAmount", "startDate", "endDate", "deliverables", "notes"],
            writeAny: ["project", "constructorRef", "title", "role", "scope", "currency", "feeAmount", "feeModel", "basisKind", "adjustmentFactor", "hourlyRate", "cappedAmount", "startDate", "endDate", "deliverables", "notes"],
        },
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
                            widgetProps: {apiUrl: "/api/realEstate/project/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true},
                        },
                        permissions: {read: "project"},
                    },
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", required: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}, permissions: {read: "constructorRef", write: "constructorRef"}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true}, permissions: {read: "title", write: "title"}},
                    {render: "#Field", field: {name: "role", widget: "#SimpleSelect", label: "form.roleLabel", placeholder: "form.rolePlaceholder", required: true, widgetProps: {options: [...CONSULTANT_ROLE_OPTIONS]}}, permissions: {read: "role", write: "role"}},
                    {render: "#Field", field: {name: "currency", widget: "#ApiSelect", label: "form.currencyLabel", placeholder: "form.currencyPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET", pageSize: 50, normalizeEmptyToUndefined: true}}, permissions: {read: "currency", write: "currency"}},
                    {render: "#Field", field: {name: "feeAmount", widget: "#Input", label: "form.feeAmountLabel", placeholder: "form.feeAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}, permissions: {read: "feeAmount", write: "feeAmount"}},
                    {render: "#Field", field: {name: "feeModel", widget: "#SimpleSelect", label: "form.feeModelLabel", placeholder: "form.feeModelPlaceholder", widgetProps: {options: [...CONSULTANT_FEE_MODEL_OPTIONS]}}, permissions: {read: "feeModel", write: "feeModel"}},
                    {render: "#Field", field: {name: "basisKind", widget: "#SimpleSelect", label: "form.basisKindLabel", placeholder: "form.basisKindPlaceholder", widgetProps: {options: [...CONSULTANT_BASIS_KIND_OPTIONS]}}, permissions: {read: "basisKind", write: "basisKind"}},
                    {
                        render: "#FormWhenFieldValueIn",
                        permissions: {readAny: ["adjustmentFactor"], writeAny: ["adjustmentFactor"]},
                        props: {watchField: "feeModel", whenValues: ["sia_102", "sia_103", "sia_108"], clearFields: ["adjustmentFactor"]},
                        children: [
                            {render: "#Field", field: {name: "adjustmentFactor", widget: "#Input", label: "form.adjustmentFactorLabel", placeholder: "form.adjustmentFactorPlaceholder", widgetProps: {type: "number", step: "0.01"}}, permissions: {read: "adjustmentFactor", write: "adjustmentFactor"}},
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        permissions: {readAny: ["hourlyRate"], writeAny: ["hourlyRate"]},
                        props: {watchField: "feeModel", whenValues: ["time_based"], clearFields: ["hourlyRate"]},
                        children: [
                            {render: "#Field", field: {name: "hourlyRate", widget: "#Input", label: "form.hourlyRateLabel", placeholder: "form.hourlyRatePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}, permissions: {read: "hourlyRate", write: "hourlyRate"}},
                        ],
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        permissions: {readAny: ["cappedAmount"], writeAny: ["cappedAmount"]},
                        props: {watchField: "feeModel", whenValues: ["time_based", "lump_sum"], clearFields: ["cappedAmount"]},
                        children: [
                            {render: "#Field", field: {name: "cappedAmount", widget: "#Input", label: "form.cappedAmountLabel", placeholder: "form.cappedAmountPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}, permissions: {read: "cappedAmount", write: "cappedAmount"}},
                        ],
                    },
                    {render: "#Field", field: {name: "startDate", widget: "#DateInput", label: "form.startDateLabel", placeholder: "form.startDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}, permissions: {read: "startDate", write: "startDate"}},
                    {render: "#Field", field: {name: "endDate", widget: "#DateInput", label: "form.endDateLabel", placeholder: "form.endDatePlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}, permissions: {read: "endDate", write: "endDate"}},
                ],
            },
            {render: "#Field", field: {name: "scope", widget: "#Textarea", label: "form.scopeLabel", placeholder: "form.scopePlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "scope", write: "scope"}},
            {render: "#Field", field: {name: "deliverables", widget: "#Textarea", label: "form.deliverablesLabel", placeholder: "form.deliverablesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "deliverables", write: "deliverables"}},
            {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}, permissions: {read: "notes", write: "notes"}},
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
                        permissions: {read: "media", write: "media"},
                    },
                ],
            },
        ],
    },
];

export const consultantAppointmentCreateFormView: ViewConfig = {
    model: "consultantappointments", viewType: "form", viewMode: "create", accessModel: "consultantappointments",
    apiUrl: "/api/realEstate/consultantAppointment", method: "PUT", nodes: consultantAppointmentCreateFormNodes,
};

export const consultantAppointmentEditFormView: ViewConfig = {
    model: "consultantappointments", viewType: "form", viewMode: "edit", accessModel: "consultantappointments",
    apiUrl: "/api/realEstate/consultantAppointment", method: "PATCH", nodes: consultantAppointmentEditFormNodes,
};

export const consultantAppointmentViews: ViewConfig[] = [consultantAppointmentSheetView, consultantAppointmentCreateFormView, consultantAppointmentEditFormView];
