import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const workPackageSheetView: ViewConfig = {
    model: "workpackages",
    viewType: "sheet",
    accessModel: "workpackages",
    apiUrl: "/api/realEstate/workPackage",
    header: {titleField: "title", subtitleKey: "workPackage", showCloseButton: true},
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
                        {render: "#SmallInfoCard", permissions: {read: "edifice"}, dependent: "edifice", field: {name: "edifice.name", widget: "#SmallInfoCard", label: "edifice", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "constructorRef"}, dependent: "constructorRef", field: {name: "constructorRef.name", widget: "#SmallInfoCard", label: "constructorRef", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "trade"}, dependent: "trade", field: {name: "trade", widget: "#SmallInfoCard", label: "trade", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "description"}, dependent: "description", field: {name: "description", widget: "#SmallInfoCard", label: "description", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "plannedStart"}, dependent: "plannedStart", field: {name: "plannedStart", widget: "#SmallInfoCard", label: "plannedStart", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "plannedEnd"}, dependent: "plannedEnd", field: {name: "plannedEnd", widget: "#SmallInfoCard", label: "plannedEnd", widgetProps: {icon: "#CalendarDays", format: "date"}}},
                        {render: "#SmallInfoCard", permissions: {read: "notes"}, dependent: "notes", field: {name: "notes", widget: "#SmallInfoCard", label: "notes", widgetProps: {icon: "#IconLabel"}}},
                        {render: "#SmallInfoCard", permissions: {read: "status"}, field: {name: "status", widget: "#SmallInfoCard", label: "status", widgetProps: {icon: "#CircleDot", languageKeyCategory: "statuses"}}},
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
                    {render: "#Field", field: {name: "edifice", widget: "#ApiSelect", label: "form.edificeLabel", placeholder: "form.edificePlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/edifice/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "constructorRef", widget: "#ApiSelect", label: "form.constructorLabel", placeholder: "form.constructorPlaceholder", skipWriteAccessGate: true, widgetProps: {apiUrl: "/api/realEstate/constructor/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    {render: "#Field", field: {name: "title", widget: "#Input", label: "form.titleLabel", placeholder: "form.titlePlaceholder", required: true, }},
                    {render: "#Field", field: {name: "trade", widget: "#Input", label: "form.tradeLabel", placeholder: "form.tradePlaceholder", }},
                    {render: "#Field", field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                    {render: "#Field", field: {name: "plannedStart", widget: "#DateInput", label: "form.plannedStartLabel", placeholder: "form.plannedStartPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "plannedEnd", widget: "#DateInput", label: "form.plannedEndLabel", placeholder: "form.plannedEndPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                    {render: "#Field", field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {className: "resize-none max-h-[200px] overflow-y-auto"}}},
                ],
            },
        ],
    },
];

export const workPackageCreateFormView: ViewConfig = {
    model: "workpackages", viewType: "form", viewMode: "create", accessModel: "workpackages",
    apiUrl: "/api/realEstate/workPackage", method: "PUT", nodes: formNodes,
};

export const workPackageEditFormView: ViewConfig = {
    model: "workpackages", viewType: "form", viewMode: "edit", accessModel: "workpackages",
    apiUrl: "/api/realEstate/workPackage", method: "PATCH", nodes: formNodes,
};

export const workPackageViews: ViewConfig[] = [workPackageSheetView, workPackageCreateFormView, workPackageEditFormView];
