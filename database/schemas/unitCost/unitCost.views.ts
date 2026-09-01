import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

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

const unitCostCreateFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
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
                ]
            },
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
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
                        field: {
                            name: "budgetedAmount",
                            widget: "#Input",
                            label: "form.budgetedAmountLabel",
                            placeholder: "form.budgetedAmountPlaceholder",
                            widgetProps: {type: "decimal", min: 0},
                        },
                    },
                    {
                        render: "#Field",
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
                        field: {
                            name: "paymentDate",
                            widget: "#DateInput",
                            label: "form.paymentDateLabel",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "tag",
                            widget: "#Input",
                            label: "form.tagLabel",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "invoiceNumber",
                            widget: "#Input",
                            label: "form.invoiceNumberLabel",
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vendorName",
                            widget: "#Input",
                            label: "form.vendorNameLabel",
                        },
                    },
                    {
                        render: "#Field",
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
                    {
                        render: "#Field",
                        field: {
                            name: "constructorRef",
                            widget: "#ApiSelect",
                            label: "form.constructorLabel",
                            placeholder: "form.constructorPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/constructor/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    // {
                    //     render: "#Field",
                    //     field: {
                    //         name: "boqItem",
                    //         widget: "#ApiSelect",
                    //         label: "form.boqItemLabel",
                    //         placeholder: "form.boqItemPlaceholder",
                    //         widgetProps: {
                    //             apiUrl: "/api/realEstate/boqItem/select",
                    //             method: "POST",
                    //             pageSize: 50,
                    //             normalizeEmptyToUndefined: true,
                    //         },
                    //     },
                    // },
                    // {
                    //     render: "#Field",
                    //     field: {
                    //         name: "costCommitment",
                    //         widget: "#ApiSelect",
                    //         label: "form.costCommitmentLabel",
                    //         placeholder: "form.costCommitmentPlaceholder",
                    //         widgetProps: {
                    //             apiUrl: "/api/realEstate/costCommitment/select",
                    //             method: "POST",
                    //             pageSize: 50,
                    //             normalizeEmptyToUndefined: true,
                    //         },
                    //     },
                    // },
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

const unitCostEditFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "generalInfo"},
        permissions: {
            readAny: [
                "project",
                "edifice",
                "floor",
                "unit",
                "purchasePerson",
                "purchaseDate",
                "currency",
                "budgetedAmount",
                "verificationStatus",
                "paymentStatus",
                "paymentDate",
                "tag",
                "invoiceNumber",
                "vendorName",
                "relatedModificationRequest",
                "constructorRef",
                "boqItem",
                "costCommitment",
            ],
            writeAny: [
                "project",
                "edifice",
                "floor",
                "unit",
                "purchasePerson",
                "purchaseDate",
                "currency",
                "budgetedAmount",
                "verificationStatus",
                "paymentStatus",
                "paymentDate",
                "tag",
                "invoiceNumber",
                "vendorName",
                "relatedModificationRequest",
                "constructorRef",
                "boqItem",
                "costCommitment",
            ],
        },
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
                            widgetProps: {
                                apiUrl: "/api/realEstate/project/select",
                                method: "POST",
                                pageSize: 50,
                                formFieldName: "project",
                                cascadeClearFormFields: ["edifice", "floor", "unit"],
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
                        }, permissions: {read: "edifice", write: "edifice"},
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
                        }, permissions: {read: "floor", write: "floor"},
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
                        }, permissions: {read: "unit", write: "unit"},
                    },
                ]
            },
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
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
                        }, permissions: {read: "purchasePerson", write: "purchasePerson"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "purchaseDate",
                            widget: "#DateInput",
                            label: "form.purchaseDateLabel",
                            required: true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        }, permissions: {read: "purchaseDate", write: "purchaseDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "currency",
                            widget: "#ApiSelect",
                            label: "form.currencyLabel",
                            placeholder: "form.currencyPlaceholder",
                            required: true,
                            widgetProps: {apiUrl: "/api/finance/currency/select", method: "GET"},
                        }, permissions: {read: "currency", write: "currency"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "budgetedAmount",
                            widget: "#Input",
                            label: "form.budgetedAmountLabel",
                            placeholder: "form.budgetedAmountPlaceholder",
                            widgetProps: {type: "decimal", min: 0},
                        }, permissions: {read: "budgetedAmount", write: "budgetedAmount"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "verificationStatus",
                            widget: "#SimpleSelect",
                            label: "form.verificationStatusLabel",
                            required: true,
                            widgetProps: {options: verificationOptions, className: "grow w-full"},
                        }, permissions: {read: "verificationStatus", write: "verificationStatus"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "paymentStatus",
                            widget: "#SimpleSelect",
                            label: "form.paymentStatusLabel",
                            required: true,
                            widgetProps: {options: paymentOptions, className: "grow w-full"},
                        }, permissions: {read: "paymentStatus", write: "paymentStatus"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "paymentDate",
                            widget: "#DateInput",
                            label: "form.paymentDateLabel",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        }, permissions: {read: "paymentDate", write: "paymentDate"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "tag",
                            widget: "#Input",
                            label: "form.tagLabel",
                        }, permissions: {read: "tag", write: "tag"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "invoiceNumber",
                            widget: "#Input",
                            label: "form.invoiceNumberLabel",
                        }, permissions: {read: "invoiceNumber", write: "invoiceNumber"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vendorName",
                            widget: "#Input",
                            label: "form.vendorNameLabel",
                        }, permissions: {read: "vendorName", write: "vendorName"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "relatedModificationRequest",
                            widget: "#ApiSelect",
                            label: "form.relatedModificationRequestLabel",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/modificationRequest/select",
                                postBodyFromFormFields: [{field: "unit", paramName: "unit"}],
                                normalizeEmptyToUndefined: true,
                            },
                        }, permissions: {read: "relatedModificationRequest", write: "relatedModificationRequest"},
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "constructorRef",
                            widget: "#ApiSelect",
                            label: "form.constructorLabel",
                            placeholder: "form.constructorPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/constructor/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        }, permissions: {read: "constructorRef", write: "constructorRef"},
                    },
                    // {
                    //     render: "#Field",
                    //     field: {
                    //         name: "boqItem",
                    //         widget: "#ApiSelect",
                    //         label: "form.boqItemLabel",
                    //         placeholder: "form.boqItemPlaceholder",
                    //         widgetProps: {
                    //             apiUrl: "/api/realEstate/boqItem/select",
                    //             method: "POST",
                    //             pageSize: 50,
                    //             normalizeEmptyToUndefined: true,
                    //         },
                    //     }, permissions: {read: "boqItem", write: "boqItem"},
                    // },
                    // {
                    //     render: "#Field",
                    //     field: {
                    //         name: "costCommitment",
                    //         widget: "#ApiSelect",
                    //         label: "form.costCommitmentLabel",
                    //         placeholder: "form.costCommitmentPlaceholder",
                    //         widgetProps: {
                    //             apiUrl: "/api/realEstate/costCommitment/select",
                    //             method: "POST",
                    //             pageSize: 50,
                    //             normalizeEmptyToUndefined: true,
                    //         },
                    //     }, permissions: {read: "costCommitment", write: "costCommitment"},
                    // },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "notes"},
        permissions: {readAny: ["notes"], writeAny: ["notes"]},
        children: [
            {
                render: "#Field",
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                }, permissions: {read: "notes", write: "notes"},
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "expenditureItems"},
        permissions: {readAny: ["expenditureItems"], writeAny: ["expenditureItems"]},
        children: [
            {
                render: "#Field",
                field: {
                    name: "expenditureItems",
                    widget: "#FormExpenditureItemsField",
                    label: "form.expenditureItemsLabel",
                }, permissions: {read: "expenditureItems", write: "expenditureItems"},
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
                permissions: {readAny: ["invoiceMedia"], writeAny: ["invoiceMedia"]},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "invoiceMedia",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {maxFiles: 20},
                        }, permissions: {read: "invoiceMedia"},
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
                permissions: {readAny: ["invoiceMedia"], writeAny: ["invoiceMedia"]},
                children: [
                    {
                        render: "#Field",
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
                        }, permissions: {read: "invoiceMedia"},
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
            permissions: {readAny: ["name", "unit", "floor", "edifice", "project", "currency", "budgetedAmount", "purchasePerson", "purchaseDate", "paymentDate", "verificationStatus", "paymentStatus", "tag", "invoiceNumber", "vendorName", "relatedModificationRequest", "constructorRef", "boqItem", "costCommitment"]},
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
                                widgetProps: {icon: "#Hash"},
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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "floor"},
                            field: {
                                name: "floor",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: {read: "edifice"},
                            field: {
                                name: "edifice",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: {read: "project"},
                            field: {
                                name: "project",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: {read: "currency"},
                            field: {
                                name: "currency",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            dependent: "budgetedAmount",
                            permissions: {read: "budgetedAmount"},
                            field: {
                                name: "budgetedAmount",
                                widget: "#DisplayCard",
                                label: "budgetedAmount",
                                widgetProps: {
                                    icon: "#Calculator",
                                    type: "currency",
                                    valuePath: ["currency.symbol", "budgetedAmount"],
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
                            permissions: {read: "purchasePerson"},
                            field: {
                                name: "purchasePerson",
                                widget: "#DisplayCard",
                                label: "purchasePerson",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "purchasePerson",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                    type: "user",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "purchaseDate"},
                            field: {
                                name: "purchaseDate",
                                widget: "#DisplayCard",
                                label: "purchaseDate",
                                widgetProps: {icon: "#Calendar", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "paymentDate"},
                            field: {
                                name: "paymentDate",
                                widget: "#DisplayCard",
                                label: "paymentDate",
                                widgetProps: {icon: "#CalendarDue", format: "date", type: "date"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "verificationStatus"},
                            field: {
                                name: "verificationStatus",
                                widget: "#DisplayCard",
                                label: "verificationStatus",
                                widgetProps: {icon: "#Shield", languageKeyCategory: "unitCostVerification", type: "enum"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "paymentStatus"},
                            field: {
                                name: "paymentStatus",
                                widget: "#DisplayCard",
                                label: "paymentStatus",
                                widgetProps: {icon: "#CreditCard", languageKeyCategory: "unitCostPayment", type: "enum"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "tag"},
                            field: {
                                name: "tag",
                                widget: "#DisplayCard",
                                label: "tag",
                                widgetProps: {icon: "#Tag"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "invoiceNumber"},
                            field: {
                                name: "invoiceNumber",
                                widget: "#DisplayCard",
                                label: "invoiceNumber",
                                widgetProps: {icon: "#FileInvoice"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "vendorName"},
                            field: {
                                name: "vendorName",
                                widget: "#DisplayCard",
                                label: "vendorName",
                                widgetProps: {icon: "#BuildingStore"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "relatedModificationRequest"},
                            field: {
                                name: "relatedModificationRequest",
                                widget: "#DisplayCard",
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
                            render: "#DisplayCard",
                            permissions: {read: "expenditureItems"},
                            field: {
                                name: "documentSubtotal",
                                widget: "#DisplayCard",
                                label: "documentSubtotal",
                                skipReadAccessGate: true,
                                widgetProps: {
                                    icon: "#Receipt",
                                    type: "currency",
                                    valuePath: ["currency.symbol", "documentSubtotal"],
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
                            permissions: {read: "constructorRef"},
                            field: {
                                name: "constructorRef.name",
                                widget: "#DisplayCard",
                                label: "constructor",
                                widgetProps: {
                                    icon: "#IconGrid4x4",
                                    linkedRefPath: "constructorRef",
                                    linkedSheetModel: "constructors",
                                    linkedSheetWidget: "#ConstructorSheetView",
                                    linkedSheetEntityProp: "constructor",
                                },
                            },
                        },
                        // {
                        //     render: "#DisplayCard",
                        //     dependent: "boqItem",
                        //     permissions: {read: "boqItem"},
                        //     field: {
                        //         name: "boqItem",
                        //         widget: "#DisplayCard",
                        //         label: "boqItem",
                        //         widgetProps: {
                        //             icon: "#ListDetails",
                        //             parent: "boqItem",
                        //             valuePath: ["title", "name"],
                        //             pickFirstTruthyValuePath: true,
                        //         },
                        //     },
                        // },
                        // {
                        //     render: "#DisplayCard",
                        //     permissions: {read: "costCommitment"},
                        //     field: {
                        //         name: "costCommitment",
                        //         widget: "#DisplayCard",
                        //         label: "costCommitment",
                        //         widgetProps: {
                        //             icon: "#FileText",
                        //             parent: "costCommitment",
                        //             valuePath: ["title", "name"],
                        //             pickFirstTruthyValuePath: true,
                        //         },
                        //     },
                        // },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            permissions: {readAny: ["notes"]},
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
            permissions: {readAny: ["expenditureItems"]},
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
            permissions: {readAny: ["invoiceMedia"]},
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
        lifecycleSheetGroup,
    ],
};

export const unitCostCreateFormView: ViewConfig = {
    model: "unitcosts",
    viewType: "form",
    viewMode: "create",
    accessModel: "unitcosts",
    apiUrl: "/api/realEstate/unit/cost",
    method: "PUT",
    nodes: unitCostCreateFormFields,
};

export const unitCostEditFormView: ViewConfig = {
    model: "unitcosts",
    viewType: "form",
    viewMode: "edit",
    accessModel: "unitcosts",
    apiUrl: "/api/realEstate/unit/cost",
    method: "PATCH",
    nodes: unitCostEditFormFields,
};

export const unitCostViews: ViewConfig[] = [unitCostSheetView, unitCostCreateFormView, unitCostEditFormView];
