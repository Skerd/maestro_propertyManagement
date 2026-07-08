import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";

export const constructorSheetView: ViewConfig = {
    model: "constructors",
    viewType: "sheet",
    accessModel: "constructors",
    apiUrl: "/api/realEstate/constructor",
    header: {
        titleField: "name",
        subtitleKey: "constructor",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: { title: "overview" },
            children: [
                {
                    render: "#SheetGrid",
                    props: { columns: 3 },
                    children: [
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "name" },
                            field: {
                                name: "name",
                                widget: "#SmallInfoCard",
                                label: "name",
                                widgetProps: { icon: "#Building2" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "vat" },
                            field: {
                                name: "vat",
                                widget: "#SmallInfoCard",
                                label: "vat",
                                widgetProps: { icon: "#Hash" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "phoneNumber" },
                            field: {
                                name: "phoneNumber",
                                widget: "#SmallInfoCard",
                                label: "phoneNumber",
                                widgetProps: { icon: "#Phone" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "email" },
                            field: {
                                name: "email",
                                widget: "#SmallInfoCard",
                                label: "email",
                                widgetProps: { icon: "#Mail" },
                            },
                        },
                        {
                            render: "#SmallInfoCard",
                            permissions: { read: "website" },
                            field: {
                                name: "website",
                                widget: "#SmallInfoCard",
                                label: "website",
                                widgetProps: { icon: "#Globe" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "constructor.sheet.addresses.display",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    props: {
                        title: "address",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    permissions: { read: "addresses" },
                    children: [
                        {
                            render: "div",
                            props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: { read: "addresses" },
                                    field: {
                                        name: "addresses",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#EmbeddedAddressCard",
                                            itemDataProp: "address",
                                            pageSize: 5,
                                            hideActions: true,
                                            listClassName: "max-h-auto",
                                            cardProps: { badgeAccessModel: "constructors" },
                                            compactRow: {
                                                icon: "#MapPin",
                                                label: "address",
                                                valuePath: ["city.name", "state.name", "country.name", "street", "postalCode"],
                                                joinSeparator: ", ",
                                            },
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
            render: "#SheetGroup",
            props: { title: "description" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ExpandableText",
                            permissions: { read: "description" },
                            field: {
                                name: "description",
                                widget: "#ExpandableText",
                                label: "description",
                                widgetProps: { className: "text-sm" },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "logo" },
            permissions: { read: "logo" },
            children: [
                {
                    render: "div",
                    props: { className: "p-4 rounded-lg bg-muted/30 border border-border/50 max-w-[200px]" },
                    children: [
                        {
                            render: "#SheetMediaAvatar",
                            permissions: { read: "logo" },
                            field: {
                                name: "logo",
                                widget: "#SheetMediaAvatar",
                                widgetProps: {
                                    nameField: "name",
                                    className: "size-15 text-sm",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: { title: "edifices" },
            dependent: "edifices",
            dependentRuntimeOnly: true,
            children: [
                {
                    render: "div",
                    props: { className: "p-4 grid md:grid-cols-2 rounded-lg bg-muted/30 border border-border/50" },
                    children: [
                        {
                            render: "#ReferencesRender",
                            field: {
                                name: "edifices",
                                widget: "#ReferencesRender",
                                widgetProps: {
                                    cardWidget: "#EdificeCard",
                                    itemDataProp: "edifice",
                                    pageSize: 3,
                                    hideActions: true,
                                    listClassName: "max-h-auto"
                                },
                            },
                        },
                    ],
                },
            ],
        },
    ],
};

const constructorFormFields: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: { title: "generalInfo" },
        children: [
            {
                render: "#FormGrid",
                props: { columns: 2 },
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "email",
                            widget: "#Input",
                            label: "form.emailLabel",
                            placeholder: "form.emailPlaceholder",
                            widgetProps: { type: "email" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "phoneNumber",
                            widget: "#PhoneInput",
                            label: "form.phoneNumberLabel",
                            placeholder: "form.phoneNumberPlaceholder",
                            widgetProps: { defaultCountry: "AL" },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vat",
                            widget: "#Input",
                            label: "form.vatLabel",
                            placeholder: "form.vatPlaceholder",
                            required: true,
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "website",
                            widget: "#Input",
                            label: "form.websiteLabel",
                            placeholder: "form.websitePlaceholder",
                        },
                    },
                    {
                        render: "div",
                        props: { className: "md:col-span-2 w-full space-y-1.5" },
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "description",
                                    widget: "#Textarea",
                                    label: "form.descriptionLabel",
                                    placeholder: "form.descriptionPlaceholder",
                                    widgetProps: {
                                        className: "min-h-[120px] max-h-[250px] w-full resize-y overflow-y-auto",
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
        render: "#Field",
        permissions: {write: "addresses"},
        field: {
            name: "addresses",
            widget: "#FormRepeater",
            widgetProps: {
                title: "howToReach",
                arrayField: "addresses",
                deleteField: "deleteAddresses",
                defaultItem: {
                    street: "",
                    postalCode: "",
                    city: "",
                    state: undefined,
                    country: "",
                    latitude: 41.3275,
                    longitude: 19.8189,
                },
                addLabel: "addAddress",
                removeLabel: "remove",
                rowTitleFields: ["street", "city", "state", "country", "postalCode"],
                rowTitlePlaceholder: "address",
                rowTemplate: [
                    {
                        render: "div",
                        props: {className: "grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch"},
                        children: [
                            {
                                render: "div",
                                props: {className: "lg:col-span-2 space-y-4 min-w-0"},
                                children: [
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 3},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "country",
                                                    widget: "#ApiSelect",
                                                    label: "form.countryLabel",
                                                    placeholder: "form.countryPlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/country/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        cascadeClearFormFields: ["state", "city"],
                                                    },
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "state",
                                                    widget: "#ApiSelect",
                                                    label: "form.stateLabel",
                                                    placeholder: "form.statePlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/state/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        postBodyFromFormFields: [{field: "country", paramName: "country"}],
                                                        enableWhenFormFieldsNonEmpty: ["country"],
                                                        cascadeClearFormFields: ["city"],
                                                    },
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "city",
                                                    widget: "#ApiSelect",
                                                    label: "form.cityLabel",
                                                    placeholder: "form.cityPlaceholder",
                                                    widgetProps: {
                                                        apiUrl: "/api/auxiliary/city/select",
                                                        method: "POST",
                                                        pageSize: 50,
                                                        postBodyFromFormFields: [{field: "country", paramName: "country"}, {field: "state", paramName: "state"}],
                                                        enableWhenFormFieldsNonEmpty: ["country"],
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 2},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {name: "street", widget: "#Input", label: "form.streetLabel", placeholder: "form.streetPlaceholder"},
                                            },
                                            {
                                                render: "#Field",
                                                field: {name: "postalCode", widget: "#Input", label: "form.postalCodeLabel", placeholder: "form.postalCodePlaceholder"},
                                            },
                                        ],
                                    },
                                    {
                                        render: "#FormGrid",
                                        props: {columns: 2},
                                        children: [
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "latitude",
                                                    widget: "#Input",
                                                    label: "form.latitudeLabel",
                                                    placeholder: "form.latitudePlaceholder",
                                                    widgetProps: {type: "number", step: "0.000001"},
                                                },
                                            },
                                            {
                                                render: "#Field",
                                                field: {
                                                    name: "longitude",
                                                    widget: "#Input",
                                                    label: "form.longitudeLabel",
                                                    placeholder: "form.longitudePlaceholder",
                                                    widgetProps: {type: "number", step: "0.000001"},
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                render: "div",
                                props: {className: "flex flex-col lg:col-span-1 w-full min-h-[220px] h-[220px] lg:h-full lg:min-h-[220px]"},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "_map",
                                            widget: "#FormMapPinPicker",
                                            widgetProps: {latField: "latitude", lngField: "longitude", defaultLat: 41.3275, defaultLng: 19.8189},
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    },
    {
        render: "#TitleWithCollapse",
        props: { title: "logo" },
        children: [
            {
                render: "#Field",
                field: {
                    name: "logo",
                    widget: "#MediaField",
                    label: "form.logoLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "single",
                    },
                },
            },
        ],
    },
];

export const constructorCreateFormView: ViewConfig = {
    model: "constructors",
    viewType: "form",
    viewMode: "create",
    accessModel: "constructors",
    apiUrl: "/api/realEstate/constructor",
    method: "PUT",
    nodes: constructorFormFields,
};

export const constructorEditFormView: ViewConfig = {
    model: "constructors",
    viewType: "form",
    viewMode: "edit",
    accessModel: "constructors",
    apiUrl: "/api/realEstate/constructor",
    method: "PATCH",
    nodes: constructorFormFields,
};

export const constructorViews: ViewConfig[] = [constructorSheetView, constructorCreateFormView, constructorEditFormView];
