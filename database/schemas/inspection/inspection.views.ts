import type {ViewConfig, ViewNode} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

const INSPECTION_FINDING_KEYS = [
    "structuralIssues",
    "electricalIssues",
    "plumbingIssues",
    "hvacIssues",
    "safetyConcerns",
    "cosmeticIssues",
    "otherObservations",
] as const;

const INSPECTION_FINDING_META: Record<(typeof INSPECTION_FINDING_KEYS)[number], { panelClass: string; titleIcon: string; titleIconClassName: string }> = {
    structuralIssues: {
        panelClass: "p-4 rounded-lg border bg-red-500/5 border-red-500/20",
        titleIcon: "#IconBuildingBridge2",
        titleIconClassName: "text-red-600 dark:text-red-400",
    },
    electricalIssues: {
        panelClass: "p-4 rounded-lg border bg-yellow-500/5 border-yellow-500/20",
        titleIcon: "#IconCircuitGround",
        titleIconClassName: "text-yellow-600 dark:text-yellow-400",
    },
    plumbingIssues: {
        panelClass: "p-4 rounded-lg border bg-blue-500/5 border-blue-500/20",
        titleIcon: "#IconRipple",
        titleIconClassName: "text-blue-600 dark:text-blue-400",
    },
    hvacIssues: {
        panelClass: "p-4 rounded-lg border bg-cyan-500/5 border-cyan-500/20",
        titleIcon: "#IconAirConditioning",
        titleIconClassName: "text-cyan-600 dark:text-cyan-400",
    },
    safetyConcerns: {
        panelClass: "p-4 rounded-lg border bg-orange-500/5 border-orange-500/20",
        titleIcon: "#IconShield",
        titleIconClassName: "text-orange-600 dark:text-orange-400",
    },
    cosmeticIssues: {
        panelClass: "p-4 rounded-lg border bg-purple-500/5 border-purple-500/20",
        titleIcon: "#IconTagStarred",
        titleIconClassName: "text-purple-600 dark:text-purple-400",
    },
    otherObservations: {
        panelClass: "p-4 rounded-lg border bg-gray-500/5 border-gray-500/20",
        titleIcon: "#IconAlertCircle",
        titleIconClassName: "text-gray-600 dark:text-gray-400",
    },
};

function inspectionFindingsCategoryNodes(): ViewNode[] {
    return INSPECTION_FINDING_KEYS.map((key) => ({
        render: "div",
        dependent: `findings.${key}`,
        permissions: { read: "findings" },
        props: { className: INSPECTION_FINDING_META[key].panelClass },
        children: [
            {
                render: "#SheetGroup",
                props: {
                    title: key,
                    titleIcon: INSPECTION_FINDING_META[key].titleIcon,
                    titleIconClassName: INSPECTION_FINDING_META[key].titleIconClassName,
                },
                children: [
                    {
                        render: "#SheetEmbeddedItemsList",
                        permissions: { read: "findings" },
                        field: {
                            name: `findings.${key}`,
                            widget: "#SheetEmbeddedItemsList",
                            widgetProps: {
                                fields: [
                                    { name: "notes", type: "expandableText" },
                                    { name: "media", type: "mediaStrip" },
                                ],
                                compactSummaryField: "notes",
                            },
                        },
                    },
                ],
            },
        ],
    }));
}

export const inspectionSheetView: ViewConfig = {
    model: "inspections",
    viewType: "sheet",
    accessModel: "inspections",
    apiUrl: "/api/realEstate/unit/inspection",
    header: {
        titleField: "name",
        subtitleKey: "inspection",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: { title: "basicInformation" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "unit",
                            permissions: { read: "unit" },
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
                            permissions: { read: "type" },
                            field: {
                                name: "type",
                                widget: "#SmallInfoCard",
                                label: "type",
                                widgetProps: { icon: "#IconLabel", languageKeyCategory: "types" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "status" },
                            field: {
                                name: "status",
                                widget: "#SmallInfoCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#CircleDot",
                                    languageKeyCategory: "statuses",
                                    variantLookupField: "status",
                                    variantLookupMap: {
                                        completed: "success",
                                        cancelled: "destructive",
                                        in_progress: "warning",
                                        scheduled: "info",
                                        rescheduled: "info",
                                    },
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "rating" },
                            field: {
                                name: "rating",
                                widget: "#SmallInfoCard",
                                label: "rating",
                                widgetProps: {
                                    icon: "#Star",
                                    variantFromRatingTenScale: true,
                                    suffix: "/10",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "followUpRequiredOutstanding",
                            dependentRuntimeOnly: true,
                            permissions: { read: "followUpRequired" },
                            field: {
                                name: "followUpRequiredOutstanding",
                                widget: "#SmallInfoCard",
                                label: "followUpRequired",
                                widgetProps: {
                                    icon: "#AlertCircle",
                                    valueType: "boolean",
                                    dontRenderValue: true,
                                    variant: "warning",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "dates" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "scheduledDate",
                            permissions: { read: "scheduledDate" },
                            field: {
                                name: "scheduledDate",
                                widget: "#SmallInfoCard",
                                label: "scheduledDate",
                                widgetProps: { icon: "#Clock", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "inspectionDate" },
                            field: {
                                name: "inspectionDate",
                                widget: "#SmallInfoCard",
                                label: "inspectionDate",
                                widgetProps: { icon: "#Calendar", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "nextInspectionDate" },
                            field: {
                                name: "nextInspectionDate",
                                widget: "#SmallInfoCard",
                                label: "nextInspectionDate",
                                widgetProps: { icon: "#CalendarClock", format: "dateTime" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "completedAt",
                            permissions: { read: "completedAt" },
                            field: {
                                name: "completedAt",
                                widget: "#SmallInfoCard",
                                label: "completedAt",
                                widgetProps: {
                                    icon: "#CalendarCheck",
                                    format: "dateTime",
                                    variant: "success",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "cancelledAt",
                            permissions: { read: "cancelledAt" },
                            field: {
                                name: "cancelledAt",
                                widget: "#SmallInfoCard",
                                label: "cancelledAt",
                                widgetProps: {
                                    icon: "#XCircle",
                                    format: "dateTime",
                                    variant: "destructive",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "people" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "inspectedBy",
                            permissions: { read: "inspectedBy" },
                            field: {
                                name: "inspectedBy",
                                widget: "#SmallInfoCard",
                                label: "inspectedBy",
                                widgetProps: {
                                    icon: "#User",
                                    parent: "inspectedBy",
                                    valuePath: ["name", "surname"],
                                    joinSeparator: " ",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            // dependent: "notes",
            props: { title: "notes" },
            children: [
                {
                    render: "div",
                    props: { className: "p-2 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "notes" },
                            field: {
                                name: "notes",
                                widget: "#ExpandableText",
                                widgetProps: { className: "text-sm" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            dependentAny: ["followUpInspection", "followedUpByInspection"],
            props: { title: "inspections" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 2 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            dependent: "followUpInspection",
                            permissions: { read: "followUpInspection" },
                            field: {
                                name: "followUpInspection.name",
                                widget: "#SmallInfoCard",
                                label: "followUpInspection",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "followUpInspection",
                                    linkedSheetModel: "inspections",
                                    linkedSheetWidget: "#InspectionSheetView",
                                    linkedSheetEntityProp: "inspection",
                                },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            dependent: "followedUpByInspection",
                            permissions: { read: "followedUpByInspection" },
                            field: {
                                name: "followedUpByInspection.name",
                                widget: "#SmallInfoCard",
                                label: "followedUpByInspection",
                                widgetProps: {
                                    icon: "#IconFolder",
                                    linkedRefPath: "followedUpByInspection",
                                    linkedSheetModel: "inspections",
                                    linkedSheetWidget: "#InspectionSheetView",
                                    linkedSheetEntityProp: "inspection",
                                },
                            },
                        },
                    ],
                }
            ],
        },
        {
            render: "#SheetGroup",
            dependent: "cancellationReason",
            permissions: { read: "cancellationReason" },
            props: { title: "cancellationReason" },
            children: [
                {
                    render: "div",
                    props: { className: "p-2 rounded-lg space-y-2 bg-red-500/10 border border-red-500/20" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "cancellationReason" },
                            field: {
                                name: "cancellationReason",
                                widget: "#ExpandableText",
                                widgetProps: {
                                    className: "text-sm text-red-600 dark:text-red-400",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: { storageKey: "inspectionFindings", defaultMode: "cards" },
            children: [
                {
                    render: "#SheetGroup",
                    dependent: "findings",
                    permissions: { read: "findings" },
                    props: { title: "findings", titleActions: "#ReferencesViewModeToggle" },
                    children: [
                        {
                            render: "div",
                            props: { className: "space-y-2" },
                            children: inspectionFindingsCategoryNodes(),
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            dependent: "media",
            props: { title: "attachments" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-full" },
                    children: [
                        {
                            render: "#SheetMediaFilesStrip",
                            permissions: { read: "media" },
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
    ],
};

const inspectionFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "div",
                props: { className: "md:col-span-2 w-full", skipRenderWhenFormExtraTruthy: "hideProjectToUnitCascade" },
                children: [
                    {
                        render: "#FormGrid",
                        props: { columns: 4 },
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
                                        postBodyFromFormField: { field: "project", paramName: "project" },
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
                                        postBodyFromFormField: { field: "edifice", paramName: "edifice" },
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
                                            { field: "edifice", paramName: "edifice" },
                                            { field: "floor", paramName: "floor" },
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
            {
                render: "#FormGrid",
                props: { columns: 3 },
                children: [
                    {
                        render: "#Field",
                        permissions: { write: "inspectedBy" },
                        field: {
                            name: "inspectedBy",
                            widget: "#ApiSelect",
                            label: "form.inspectedByLabel",
                            placeholder: "form.inspectedByPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/company/users/select",
                                method: "POST",
                                postBody: { administration: true },
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "inspectionDate" },
                        field: {
                            name: "inspectionDate",
                            widget: "#DateInput",
                            label: "form.inspectionDateLabel",
                            placeholder: "form.inspectionDatePlaceholder",
                            required: true,
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "type" },
                        field: {
                            name: "type",
                            widget: "#SimpleSelect",
                            label: "form.typeLabel",
                            placeholder: "form.typePlaceholder",
                            required: true,
                            widgetProps: {
                                options: [
                                    { value: "initial", label: "form.typeInitial" },
                                    { value: "follow_up", label: "form.typeFollowUp" },
                                    { value: "final", label: "form.typeFinal" },
                                    { value: "routine", label: "form.typeRoutine" },
                                    { value: "complaint", label: "form.typeComplaint" },
                                    { value: "pre_sale", label: "form.typePreSale" },
                                    { value: "post_sale", label: "form.typePostSale" },
                                ],
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "rating" },
                        field: {
                            name: "rating",
                            widget: "#Input",
                            label: "form.ratingLabel",
                            placeholder: "form.ratingPlaceholder",
                            widgetProps: { type: "number", min: 1, max: 10 },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "status" },
                        field: {
                            name: "status",
                            widget: "#SimpleSelect",
                            label: "form.statusLabel",
                            placeholder: "form.statusPlaceholder",
                            required: true,
                            widgetProps: {
                                options: [
                                    { value: "scheduled", label: "form.statusScheduled" },
                                    { value: "in_progress", label: "form.statusInProgress" },
                                    { value: "completed", label: "form.statusCompleted" },
                                    { value: "rescheduled", label: "form.statusRescheduled" },
                                    { value: "cancelled", label: "form.statusCancelled" },
                                ],
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#FormWhenFieldValueIn",
                        permissions: { write: "scheduledDate" },
                        props: {
                            watchField: "status",
                            whenValues: ["scheduled", "rescheduled"],
                            clearFields: ["scheduledDate"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "scheduledDate",
                                    widget: "#DateInput",
                                    label: "form.scheduledDateLabel",
                                    placeholder: "form.scheduledDatePlaceholder",
                                    widgetProps: { valueFormat: "yyyy-MM-dd" },
                                },
                            },
                        ],
                    },
                    {
                        render: "#Field",
                        permissions: { write: "nextInspectionDate" },
                        field: {
                            name: "nextInspectionDate",
                            widget: "#DateInput",
                            label: "form.nextInspectionDateLabel",
                            placeholder: "form.nextInspectionDatePlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "followUpInspection" },
                        field: {
                            name: "followUpInspection",
                            widget: "#ApiSelect",
                            label: "form.followUpInspectionLabel",
                            placeholder: "form.followUpInspectionPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/realEstate/unit/inspection/select",
                                postBody: { followUp: true },
                                postBodyFormExtrasMerge: { notId: "inspectionId" },
                                postBodyFromFormFields: [{ field: "unit", paramName: "unit" }],
                                postBodyParamFallbackFromExtras: [
                                    {
                                        whenFieldEmpty: "unit",
                                        paramName: "unit",
                                        formExtraKey: "defaultUnitId",
                                    },
                                ],
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "followUpRequired" },
                        field: {
                            name: "followUpRequired",
                            widget: "#Checkbox",
                            label: "form.followUpRequiredLabel",
                        },
                    },
                ],
            },
            {
                render: "div",
                props: { className: "w-full", skipRenderWhenFormExtraTruthy: "hideInspectionEditOnlyBlocks" },
                children: [
                    {
                        render: "#FormWhenFieldValueIn",
                        permissions: { writeAny: ["cancellationReason", "status"] },
                        props: {
                            watchField: "status",
                            whenValues: ["cancelled"],
                            clearFields: ["cancellationReason"],
                        },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "cancellationReason",
                                    renderWhenWriteAny: ["cancellationReason", "status"],
                                    widget: "#Textarea",
                                    label: "form.cancellationReasonLabel",
                                    placeholder: "form.cancellationReasonPlaceholder",
                                    widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        permissions: { write: "notes" },
        props: { title: "notes" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        permissions: { writeAny: ["clientSignatureMediaId", "clientSignedAt"] },
        props: { title: "clientSignature" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        permissions: { write: "clientSignatureMediaId" },
                        field: {
                            name: "clientSignatureMediaId",
                            widget: "#FormLocalFileField",
                            label: "form.clientSignatureMediaIdLabel",
                            skipWriteAccessGate: true,
                            widgetProps: { maxFiles: 1 },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: { write: "clientSignedAt" },
                        field: {
                            name: "clientSignedAt",
                            widget: "#DateInput",
                            label: "form.clientSignedAtLabel",
                            placeholder: "form.clientSignedAtPlaceholder",
                            widgetProps: { valueFormat: "yyyy-MM-dd" },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        permissions: { write: "findings" },
        props: { title: "findings" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "findings",
                    widget: "#FormTabbedRepeater",
                    skipWriteAccessGate: true,
                    widgetProps: {
                        tabs: [
                            { key: "structuralIssues",  label: "form.structuralIssuesLabel"  },
                            { key: "electricalIssues",  label: "form.electricalIssuesLabel"  },
                            { key: "plumbingIssues",    label: "form.plumbingIssuesLabel"    },
                            { key: "hvacIssues",        label: "form.hvacIssuesLabel"        },
                            { key: "safetyConcerns",    label: "form.safetyConcernsLabel"    },
                            { key: "cosmeticIssues",    label: "form.cosmeticIssuesLabel"    },
                            { key: "otherObservations", label: "form.otherObservationsLabel" },
                        ],
                        defaultItem: { notes: "", media: [], resolvedAt: "", resolvedBy: "" },
                        rowTitleFields: ["notes"],
                        rowTitlePlaceholder: "form.findingLabel",
                        addLabel: "form.addFindingLabel",
                        removeLabel: "form.removeFindingLabel",
                        rowTemplate: [
                            {
                                render: "#Field",
                                field: {
                                    name: "notes",
                                    widget: "#Textarea",
                                    label: "form.notesLabel",
                                    placeholder: "form.addFindingPlaceholder",
                                    widgetProps: { className: "resize-none max-h-[250px] overflow-y-auto" },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "media",
                                    widget: "#FormMultiLocalFileField",
                                    widgetProps: {
                                        maxFiles: 10,
                                        addFileKey: "form.addFile",
                                        filesSelectedKey: "form.filesSelected",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "resolvedAt",
                                    widget: "#DateInput",
                                    label: "form.resolvedAtLabel",
                                    placeholder: "form.resolvedAtPlaceholder",
                                    widgetProps: { valueFormat: "yyyy-MM-dd" },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "resolvedBy",
                                    widget: "#ApiSelect",
                                    label: "form.resolvedByLabel",
                                    placeholder: "form.resolvedByPlaceholder",
                                    widgetProps: {
                                        apiUrl: "/api/company/users/select",
                                        method: "POST",
                                        postBody: { administration: true },
                                        normalizeEmptyToUndefined: true,
                                    },
                                },
                            },
                        ],
                    },
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
                props: { title: "form.mediaLabel" },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "media",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: { maxFiles: 10 },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "div",
        permissions: { write: "media" },
        props: {
            className: "col-span-full w-full",
            skipRenderWhenFormExtraTruthy: "enableLocalFileMultipart",
        },
        children: [
            {
                render: "#TitleWithCollapse",
                props: { title: "form.mediaLabel" },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "media",
                            widget: "#FormMultiLocalFileField",
                            skipWriteAccessGate: true,
                            widgetProps: {
                                maxFiles: 10,
                                existingListExtraKey: "editMediaExistingList",
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export const inspectionCreateFormView: ViewConfig = {
    model: "inspections",
    viewType: "form",
    viewMode: "create",
    accessModel: "inspections",
    apiUrl: "/api/realEstate/unit/inspection",
    method: "PUT",
    nodes: inspectionFormFields,
};

export const inspectionEditFormView: ViewConfig = {
    model: "inspections",
    viewType: "form",
    viewMode: "edit",
    accessModel: "inspections",
    apiUrl: "/api/realEstate/unit/inspection",
    method: "PATCH",
    nodes: inspectionFormFields,
};

export const inspectionViews: ViewConfig[] = [inspectionSheetView, inspectionCreateFormView, inspectionEditFormView];
