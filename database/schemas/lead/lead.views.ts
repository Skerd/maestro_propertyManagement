import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

const leadStatusOptions = [
    {value: "new",         label: "form.statusNew"},
    {value: "contacted",   label: "form.statusContacted"},
    {value: "qualified",   label: "form.statusQualified"},
    {value: "proposal",    label: "form.statusProposal"},
    {value: "negotiation", label: "form.statusNegotiation"},
    {value: "won",         label: "form.statusWon"},
    {value: "lost",        label: "form.statusLost"},
];

const leadSourceOptions = [
    {value: "website",   label: "form.sourceWebsite"},
    {value: "referral",  label: "form.sourceReferral"},
    {value: "social",    label: "form.sourceSocial"},
    {value: "event",     label: "form.sourceEvent"},
    {value: "cold_call", label: "form.sourceColdCall"},
    {value: "walk_in",   label: "form.sourceWalkIn"},
    {value: "other",     label: "form.sourceOther"},
];

const leadCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props:  {columns: 2},
        children: [
            {
                render: "#Field",
                field: {
                    name:        "firstName",
                    widget:      "#Input",
                    label:       "form.firstNameLabel",
                    placeholder: "form.firstNamePlaceholder",
                    required:    true,
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "lastName",
                    widget:      "#Input",
                    label:       "form.lastNameLabel",
                    placeholder: "form.lastNamePlaceholder",
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "email",
                    widget:      "#Input",
                    label:       "form.emailLabel",
                    placeholder: "form.emailPlaceholder",
                    widgetProps: {type: "email"},
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "phone",
                    widget:      "#Input",
                    label:       "form.phoneLabel",
                    placeholder: "form.phonePlaceholder",
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "status",
                    widget:      "#SimpleSelect",
                    label:       "form.statusLabel",
                    placeholder: "form.statusPlaceholder",
                    widgetProps: {options: leadStatusOptions, className: "grow w-full"},
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "source",
                    widget:      "#SimpleSelect",
                    label:       "form.sourceLabel",
                    placeholder: "form.sourcePlaceholder",
                    widgetProps: {options: leadSourceOptions, className: "grow w-full"},
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "projectInterest",
                    widget:      "#ApiSelect",
                    label:       "form.projectInterestLabel",
                    placeholder: "form.projectInterestPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/realEstate/project/select",
                        method:                  "POST",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "unitInterest",
                    widget:      "#ApiSelect",
                    label:       "form.unitInterestLabel",
                    placeholder: "form.unitInterestPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/realEstate/unit/select",
                        method:                  "POST",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "budget",
                    widget:      "#Input",
                    label:       "form.budgetLabel",
                    placeholder: "form.budgetPlaceholder",
                    widgetProps: {type: "number", min: 0, step: 0.01},
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "budgetCurrency",
                    widget:      "#ApiSelect",
                    label:       "form.budgetCurrencyLabel",
                    placeholder: "form.budgetCurrencyPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/finance/currency/select",
                        method:                  "GET",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "assignedTo",
                    widget:      "#ApiSelect",
                    label:       "form.assignedToLabel",
                    placeholder: "form.assignedToPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/company/users/select",
                        method:                  "POST",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name:        "followUpDate",
                    widget:      "#DateInput",
                    label:       "form.followUpDateLabel",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
        ],
    },
    {
        render: "#Field",
        field: {
            name:        "notes",
            widget:      "#Textarea",
            label:       "form.notesLabel",
            placeholder: "form.notesPlaceholder",
            widgetProps: {className: "resize-none max-h-[250px] overflow-y-auto"},
        },
    },
];

const leadEditFormHiddenId: ViewConfig["nodes"] = [
    {
        render: "#Field",
        field: {
            name:        "_id",
            widget:      "#Input",
            widgetProps: {
                type:      "hidden",
                className: "sr-only !absolute !h-px !w-px !p-0 !m-0 !border-0 !overflow-hidden",
            },
        },
    },
];

const leadEditFormNodes: ViewConfig["nodes"] = [
    ...leadEditFormHiddenId,
    {
        render: "#FormGrid",
        props:  {columns: 2},
        permissions: {writeAny: ["firstName", "lastName", "email", "phone", "status", "source", "projectInterest", "unitInterest", "budget", "budgetCurrency", "assignedTo", "followUpDate"]},
        children: [
            {
                render: "#Field",
                permissions: {write: "firstName"},
                field: {
                    name:        "firstName",
                    widget:      "#Input",
                    label:       "form.firstNameLabel",
                    placeholder: "form.firstNamePlaceholder",
                    required:    true,
                },
            },
            {
                render: "#Field",
                permissions: {write: "lastName"},
                field: {
                    name:        "lastName",
                    widget:      "#Input",
                    label:       "form.lastNameLabel",
                    placeholder: "form.lastNamePlaceholder",
                },
            },
            {
                render: "#Field",
                permissions: {write: "email"},
                field: {
                    name:        "email",
                    widget:      "#Input",
                    label:       "form.emailLabel",
                    placeholder: "form.emailPlaceholder",
                    widgetProps: {type: "email"},
                },
            },
            {
                render: "#Field",
                permissions: {write: "phone"},
                field: {
                    name:        "phone",
                    widget:      "#Input",
                    label:       "form.phoneLabel",
                    placeholder: "form.phonePlaceholder",
                },
            },
            {
                render: "#Field",
                permissions: {write: "status"},
                field: {
                    name:        "status",
                    widget:      "#SimpleSelect",
                    label:       "form.statusLabel",
                    placeholder: "form.statusPlaceholder",
                    widgetProps: {options: leadStatusOptions, className: "grow w-full"},
                },
            },
            {
                render: "#Field",
                permissions: {write: "source"},
                field: {
                    name:        "source",
                    widget:      "#SimpleSelect",
                    label:       "form.sourceLabel",
                    placeholder: "form.sourcePlaceholder",
                    widgetProps: {options: leadSourceOptions, className: "grow w-full"},
                },
            },
            {
                render: "#Field",
                permissions: {write: "projectInterest"},
                field: {
                    name:        "projectInterest",
                    widget:      "#ApiSelect",
                    label:       "form.projectInterestLabel",
                    placeholder: "form.projectInterestPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/realEstate/project/select",
                        method:                  "POST",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {write: "unitInterest"},
                field: {
                    name:        "unitInterest",
                    widget:      "#ApiSelect",
                    label:       "form.unitInterestLabel",
                    placeholder: "form.unitInterestPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/realEstate/unit/select",
                        method:                  "POST",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {write: "budget"},
                field: {
                    name:        "budget",
                    widget:      "#Input",
                    label:       "form.budgetLabel",
                    placeholder: "form.budgetPlaceholder",
                    widgetProps: {type: "number", min: 0, step: 0.01},
                },
            },
            {
                render: "#Field",
                permissions: {write: "budgetCurrency"},
                field: {
                    name:        "budgetCurrency",
                    widget:      "#ApiSelect",
                    label:       "form.budgetCurrencyLabel",
                    placeholder: "form.budgetCurrencyPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/finance/currency/select",
                        method:                  "GET",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {write: "assignedTo"},
                field: {
                    name:        "assignedTo",
                    widget:      "#ApiSelect",
                    label:       "form.assignedToLabel",
                    placeholder: "form.assignedToPlaceholder",
                    widgetProps: {
                        apiUrl:                  "/api/company/users/select",
                        method:                  "POST",
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {write: "followUpDate"},
                field: {
                    name:        "followUpDate",
                    widget:      "#DateInput",
                    label:       "form.followUpDateLabel",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
        ],
    },
    {
        render: "#Field",
        permissions: {write: "notes"},
        field: {
            name:        "notes",
            widget:      "#Textarea",
            label:       "form.notesLabel",
            placeholder: "form.notesPlaceholder",
            widgetProps: {className: "resize-none max-h-[250px] overflow-y-auto"},
        },
    },
];

export const leadCreateFormView: ViewConfig = {
    model:      "leads",
    viewType:   "form",
    viewMode:   "create",
    accessModel: "leads",
    apiUrl:     "/api/realEstate/lead",
    method:     "PUT",
    nodes:      leadCreateFormNodes,
};

export const leadEditFormView: ViewConfig = {
    model:      "leads",
    viewType:   "form",
    viewMode:   "edit",
    accessModel: "leads",
    apiUrl:     "/api/realEstate/lead",
    method:     "PATCH",
    nodes:      leadEditFormNodes,
};

export const leadSheetView: ViewConfig = {
    model:       "leads",
    viewType:    "sheet",
    accessModel: "leads",
    apiUrl:      "/api/realEstate/lead",
    header: {
        titleField:      "name",
        subtitleKey:     "lead",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props:  {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props:  {columns: 3},
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "firstName"},
                            field: {
                                name:        "firstName",
                                widget:      "#SmallInfoCard",
                                label:       "firstName",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "lastName"},
                            field: {
                                name:        "lastName",
                                widget:      "#SmallInfoCard",
                                label:       "lastName",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "status"},
                            field: {
                                name:        "status",
                                widget:      "#SmallInfoCard",
                                label:       "status",
                                widgetProps: {
                                    icon:                 "#CircleDot",
                                    languageKeyCategory:  "statuses",
                                    variantLookupField:   "status",
                                    variantLookupMap: {
                                        new:         "info",
                                        contacted:   "warning",
                                        qualified:   "success",
                                        proposal:    "info",
                                        negotiation: "warning",
                                        won:         "success",
                                        lost:        "destructive",
                                    },
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "source"},
                            field: {
                                name:        "source",
                                widget:      "#SmallInfoCard",
                                label:       "source",
                                widgetProps: {
                                    icon:                "#Globe",
                                    languageKeyCategory: "sources",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "email"},
                            field: {
                                name:        "email",
                                widget:      "#SmallInfoCard",
                                label:       "email",
                                widgetProps: {icon: "#IconLabel"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "phone"},
                            field: {
                                name:        "phone",
                                widget:      "#SmallInfoCard",
                                label:       "phone",
                                widgetProps: {icon: "#Phone"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "projectInterest"},
                            field: {
                                name:        "projectInterest",
                                widget:      "#SmallInfoCard",
                                label:       "projectInterest",
                                widgetProps: {
                                    icon:                  "#IconFolder",
                                    linkedRefPath:         "projectInterest",
                                    linkedSheetModel:      "projects",
                                    linkedSheetWidget:     "#ProjectSheetView",
                                    linkedSheetEntityProp: "project",
                                    parent:                "projectInterest",
                                    valuePath:             ["name"],
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "unitInterest"},
                            field: {
                                name:        "unitInterest",
                                widget:      "#SmallInfoCard",
                                label:       "unitInterest",
                                widgetProps: {
                                    icon:                  "#DoorOpen",
                                    linkedRefPath:         "unitInterest",
                                    linkedSheetModel:      "units",
                                    linkedSheetWidget:     "#UnitSheetView",
                                    linkedSheetEntityProp: "unit",
                                    parent:                "unitInterest",
                                    valuePath:             ["name", "unitNumber", "_id"],
                                    pickFirstTruthyValuePath: true,
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {readAny: ["budget", "budgetCurrency"]},
                            field: {
                                name:        "budget",
                                widget:      "#SmallInfoCard",
                                label:       "budget",
                                widgetProps: {
                                    icon:                  "#DollarSign",
                                    format:                "locale",
                                    valuePath:             ["budgetCurrency.symbol", "budget"],
                                    joinSeparator:         " ",
                                    linkedRefPath:         "budgetCurrency",
                                    linkedSheetModel:      "currencies",
                                    linkedSheetWidget:     "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "budgetCurrency"},
                            field: {
                                name:        "budgetCurrency",
                                widget:      "#SmallInfoCard",
                                label:       "budgetCurrency",
                                widgetProps: {
                                    icon:                  "#IconCurrencyDollar",
                                    valuePath:             ["budgetCurrency.symbol", "budgetCurrency.name"],
                                    joinSeparator:         " ",
                                    linkedRefPath:         "budgetCurrency",
                                    linkedSheetModel:      "currencies",
                                    linkedSheetWidget:     "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "assignedTo"},
                            field: {
                                name:        "assignedTo",
                                widget:      "#SmallInfoCard",
                                label:       "assignedTo",
                                widgetProps: {
                                    icon:          "#User",
                                    parent:        "assignedTo",
                                    valuePath:     ["name", "surname"],
                                    joinSeparator: " ",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: {read: "followUpDate"},
                            field: {
                                name:        "followUpDate",
                                widget:      "#SmallInfoCard",
                                label:       "followUpDate",
                                widgetProps: {icon: "#Calendar", format: "date"},
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "convertedAt",
                            permissions: {read: "convertedAt"},
                            field: {
                                name:        "convertedAt",
                                widget:      "#SmallInfoCard",
                                label:       "convertedAt",
                                widgetProps: {
                                    icon:    "#CalendarCheck",
                                    format:  "dateTime",
                                    variant: "success",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props:  {title: "notes"},
            children: [
                {
                    render: "div",
                    props:  {className: "p-2 rounded-lg bg-muted/30 border border-border/50"},
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: {read: "notes"},
                            field: {
                                name:        "notes",
                                widget:      "#ExpandableText",
                                widgetProps: {className: "text-sm"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props:  {
                storageKey:  "lead.sheet.activityLog.listDisplay",
                defaultMode: "compact",
            },
            children: [
                {
                    render:    "#SheetGroup",
                    dependent: "activityLog",
                    props:     {
                        title:        "activityLog",
                        titleIcon:    "#History",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props:  {className: "p-4 rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#SheetEmbeddedItemsList",
                                    permissions: {read: "activityLog"},
                                    field: {
                                        name:        "activityLog",
                                        widget:      "#SheetEmbeddedItemsList",
                                        widgetProps: {
                                            pageSize: 3,
                                            sortField: "performedAt",
                                            sortDescending: true,
                                            compactSummaryFields: ["performedBy", "action", "performedAt"],
                                            fields: [
                                                {
                                                    name:                "action",
                                                    type:                "text",
                                                    className:           "text-sm font-medium",
                                                    languageKeyCategory: "activityActions",
                                                },
                                                {
                                                    name:          "performedBy",
                                                    type:          "text",
                                                    valuePath:     ["name", "surname"],
                                                    joinSeparator: " ",
                                                    className:     "text-xs text-muted-foreground",
                                                },
                                                {
                                                    name:      "performedAt",
                                                    type:      "text",
                                                    format:    "dateTime",
                                                    className: "text-xs text-muted-foreground",
                                                },
                                                {
                                                    name:      "notes",
                                                    type:      "expandableText",
                                                    className: "text-sm text-muted-foreground",
                                                },
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
    ],
};

export const leadViews = [leadSheetView, leadCreateFormView, leadEditFormView];
