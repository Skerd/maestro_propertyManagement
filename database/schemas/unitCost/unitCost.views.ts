import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

const unitCostCascadeFormChildren: ViewConfig["nodes"] = [
    {
        render: "div",
        props: {className: "md:col-span-2 w-full", skipRenderWhenFormExtraTruthy: "hideProjectToUnitCascade"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 4},
                children: [
                    {
                        render: "#Field",
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
                                enableWhenFormFieldsNonEmpty: ["project"],
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
                                enableWhenFormFieldsNonEmpty: ["edifice"],
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
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "unit",
                                postBodyFromFormFields: [
                                    {field: "edifice", paramName: "edifice"},
                                    {field: "floor", paramName: "floor"},
                                ],
                                remountKeyFormField: "edifice",
                                enableWhenFormFieldsNonEmpty: ["project", "edifice"],
                            },
                        },
                    },
                ],
            },
        ],
    },
];

const verificationOptions = [
    {value: "pending_verification", label: "form.unitCostVerificationPending"},
    {value: "verified", label: "form.unitCostVerificationVerified"},
    {value: "rejected", label: "form.unitCostVerificationRejected"},
    {value: "needs_revision", label: "form.unitCostVerificationNeedsRevision"},
];

const paymentOptions = [
    {value: "unpaid", label: "form.unitCostPaymentUnpaid"},
    {value: "partially_paid", label: "form.unitCostPaymentPartiallyPaid"},
    {value: "paid", label: "form.unitCostPaymentPaid"},
    {value: "waived", label: "form.unitCostPaymentWaived"},
    {value: "disputed", label: "form.unitCostPaymentDisputed"},
];

const unitCostFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 1},
                children: unitCostCascadeFormChildren as ViewConfig["nodes"],
            },
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {write: "purchasePerson"},
                        field: {
                            name: "purchasePerson",
                            widget: "#ApiSelect",
                            label: "form.purchasePersonLabel",
                            placeholder: "form.purchasePersonPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: {administration: true},
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "purchaseDate"},
                        field: {
                            name: "purchaseDate",
                            widget: "#DateInput",
                            label: "form.purchaseDateLabel",
                            required: true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "currency"},
                        field: {
                            name: "currency",
                            widget: "#ApiSelect",
                            label: "form.currencyLabel",
                            placeholder: "form.currencyPlaceholder",
                            required: true,
                            widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "verificationStatus"},
                        field: {
                            name: "verificationStatus",
                            widget: "#SimpleSelect",
                            label: "form.verificationStatusLabel",
                            required: true,
                            widgetProps: {options: verificationOptions, className: "grow w-full"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "paymentStatus"},
                        field: {
                            name: "paymentStatus",
                            widget: "#SimpleSelect",
                            label: "form.paymentStatusLabel",
                            required: true,
                            widgetProps: {options: paymentOptions, className: "grow w-full"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "paymentDate"},
                        field: {
                            name: "paymentDate",
                            widget: "#DateInput",
                            label: "form.paymentDateLabel",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "tag"},
                        field: {
                            name: "tag",
                            widget: "#Input",
                            label: "form.tagLabel",
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "invoiceNumber"},
                        field: {
                            name: "invoiceNumber",
                            widget: "#Input",
                            label: "form.invoiceNumberLabel",
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "vendorName"},
                        field: {
                            name: "vendorName",
                            widget: "#Input",
                            label: "form.vendorNameLabel",
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {write: "relatedModificationRequest"},
                        field: {
                            name: "relatedModificationRequest",
                            widget: "#ApiSelect",
                            label: "form.relatedModificationRequestLabel",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/modificationRequest/select",
                                postBodyFromFormFields: [{field: "unit", paramName: "unit"}],
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "notes"},
        children: [
            {
                render: "#Field",
                permissions: {write: "notes"},
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "expenditureItems"},
        children: [
            {
                render: "#Field",
                permissions: {write: "expenditureItems"},
                field: {
                    name: "expenditureItems",
                    widget: "#FormExpenditureItemsField",
                    label: "form.expenditureItemsLabel",
                },
            },
        ],
    },
    {
        render: "div",
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraTruthy: "enableLocalFileMultipart",
        },
        children: [
            {
                render: "#TitleWithCollapse",
                props: {title: "form.invoiceMediaLabel"},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "invoiceMedia",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {maxFiles: 20},
                        },
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
                props: {title: "form.invoiceMediaLabel"},
                children: [
                    {
                        render: "#Field",
                        permissions: {write: "invoiceMedia"},
                        field: {
                            name: "invoiceMedia",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 20,
                                existingListExtraKey: "editUnitCostInvoiceMediaList",
                                existingFilesLabelKey: "form.existingFilesLabel",
                                newFilesLabelKey: "form.newFilesLabel",
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export const unitCostSheetView: ViewConfig = {
    model: "unitcosts",
    viewType: "sheet",
    accessModel: "unitcosts",
    apiUrl: "/api/realEstate/unit/cost",
    header: {
        titleField: "name",
        subtitleKey: "unitCost",
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
                                widgetProps: {icon: "#Hash"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "unit",
                            permissions: {read: "unit"},
                            field: {
                                name: "unit",
                                widget: "#SmallInfoCard",
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
                        {
                            render: "#SmallInfoCard",
                            dependent: "floor",
                            permissions: {read: "floor"},
                            field: {
                                name: "floor",
                                widget: "#SmallInfoCard",
                                label: "floor",
                                widgetProps: {
                                    icon: "#Stack2",
                                    linkedRefPath: "floor",
                                    linkedSheetModel: "floors",
                                    linkedSheetWidget: "#FloorSheetView",
                                    linkedSheetEntityProp: "floor",
                                    parent: "floor",
                                    valuePath: ["name", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "edifice",
                            permissions: {read: "edifice"},
                            field: {
                                name: "edifice",
                                widget: "#SmallInfoCard",
                                label: "edifice",
                                widgetProps: {
                                    icon: "#BuildingSkyscraper",
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
                            render: "#SmallInfoCard",
                            dependent: "project",
                            permissions: {read: "project"},
                            field: {
                                name: "project",
                                widget: "#SmallInfoCard",
                                label: "project",
                                widgetProps: {
                                    icon: "#BuildingCommunity",
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
                            render: "#SmallInfoCard",
                            dependent: "currency",
                            permissions: {read: "currency"},
                            field: {
                                name: "currency",
                                widget: "#SmallInfoCard",
                                label: "currency",
                                widgetProps: {
                                    icon: "#CurrencyDollar",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                    parent: "currency",
                                    valuePath: ["symbol", "abbreviation", "name"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "purchasePerson"},
                            field: {
                                name: "purchasePerson",
                                widget: "#SmallInfoCard",
                                label: "purchasePerson",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "purchasePerson",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "purchaseDate"},
                            field: {
                                name: "purchaseDate",
                                widget: "#SmallInfoCard",
                                label: "purchaseDate",
                                widgetProps: {icon: "#Calendar", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "paymentDate"},
                            field: {
                                name: "paymentDate",
                                widget: "#SmallInfoCard",
                                label: "paymentDate",
                                widgetProps: {icon: "#CalendarDue", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "verificationStatus"},
                            field: {
                                name: "verificationStatus",
                                widget: "#SmallInfoCard",
                                label: "verificationStatus",
                                widgetProps: {icon: "#Shield", languageKeyCategory: "unitCostVerification"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "paymentStatus"},
                            field: {
                                name: "paymentStatus",
                                widget: "#SmallInfoCard",
                                label: "paymentStatus",
                                widgetProps: {icon: "#CreditCard", languageKeyCategory: "unitCostPayment"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "tag"},
                            field: {
                                name: "tag",
                                widget: "#SmallInfoCard",
                                label: "tag",
                                widgetProps: {icon: "#Tag"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "invoiceNumber"},
                            field: {
                                name: "invoiceNumber",
                                widget: "#SmallInfoCard",
                                label: "invoiceNumber",
                                widgetProps: {icon: "#FileInvoice"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "vendorName"},
                            field: {
                                name: "vendorName",
                                widget: "#SmallInfoCard",
                                label: "vendorName",
                                widgetProps: {icon: "#BuildingStore"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "relatedModificationRequest",
                            permissions: {read: "relatedModificationRequest"},
                            field: {
                                name: "relatedModificationRequest",
                                widget: "#SmallInfoCard",
                                label: "relatedModificationRequest",
                                widgetProps: {
                                    icon: "#Hammer",
                                    linkedRefPath: "relatedModificationRequest",
                                    linkedSheetModel: "modificationRequests",
                                    linkedSheetWidget: "#ModificationRequestSheetView",
                                    linkedSheetEntityProp: "request",
                                    parent: "relatedModificationRequest",
                                    valuePath: ["name", "title"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "documentSubtotal"},
                            field: {
                                name: "documentSubtotal",
                                widget: "#SmallInfoCard",
                                label: "documentSubtotal",
                                widgetProps: {icon: "#Receipt", format: "locale"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "notes"},
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
            props: {title: "expenditureItems"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#SheetModificationLineItems",
                            permissions: {read: "expenditureItems"},
                            field: {
                                name: "expenditureItems",
                                widget: "#SheetModificationLineItems",
                                widgetProps: {
                                    variant: "expenditureItems",
                                    currencyPath: "currency",
                                    totalPath: "documentSubtotal",
                                    totalLabelKey: "template.tableTotal",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "invoiceMedia"},
            children: [
                {
                    render: "div",
                    props: {className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full"},
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: {read: "invoiceMedia"},
                            field: {
                                name: "invoiceMedia",
                                widget: "#SheetMediaFilesStrip",
                                widgetProps: {canDownload: true, canRemove: false},
                            },
                        },
                    ],
                },
            ],
        },
    ],
};

export const unitCostCreateFormView: ViewConfig = {
    model: "unitcosts",
    viewType: "form",
    viewMode: "create",
    accessModel: "unitcosts",
    apiUrl: "/api/realEstate/unit/cost",
    method: "PUT",
    nodes: unitCostFormFields,
};

export const unitCostEditFormView: ViewConfig = {
    model: "unitcosts",
    viewType: "form",
    viewMode: "edit",
    accessModel: "unitcosts",
    apiUrl: "/api/realEstate/unit/cost",
    method: "PATCH",
    nodes: [
        {
            render: "#Field",
            field: {
                name: "_id",
                widget: "#Input",
                label: "form.idLabel",
                widgetProps: {type: "hidden"},
            },
        },
        ...unitCostFormFields,
    ],
};

export const unitCostViews: ViewConfig[] = [unitCostSheetView, unitCostCreateFormView, unitCostEditFormView];
