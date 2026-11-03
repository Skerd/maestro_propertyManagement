import {describe, expect, it} from "vitest";
import {selectOldPdfCenterRectangle, selectOldPdfPositionSchematic, selectOldPdfTopRightRectangle} from "../rectangleDetectionUtils";
import type {HorizontalSegment, Rectangle, VerticalSegment} from "../../types";

function rect(left: number, top: number, right: number, bottom: number): Rectangle {
    return {
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2,
    };
}

function hLine(y: number, xStart: number, xEnd: number): HorizontalSegment {
    return {y, xStart, xEnd};
}

function vLine(x: number, yStart: number, yEnd: number): VerticalSegment {
    return {x, yStart, yEnd};
}

describe("selectOldPdfCenterRectangle", () => {
    const width = 1000;
    const height = 700;

    it("crops the page frame between header and footer separator lines", () => {
        const pageFrame = rect(10, 8, 990, 692);
        const selected = selectOldPdfCenterRectangle(
            [pageFrame],
            [
                hLine(8, 10, 990),
                hLine(70, 10, 990),
                hLine(630, 10, 990),
                hLine(692, 10, 990),
            ],
            width,
            height,
        );

        expect(selected).toMatchObject({
            left: 10,
            right: 990,
            top: 70,
            bottom: 630,
        });
        expect(selected!.top).toBeGreaterThan(pageFrame.top);
        expect(selected!.bottom).toBeLessThan(pageFrame.bottom);
    });

    it("prefers a large inner plan rectangle over the sheet frame", () => {
        const pageFrame = rect(10, 8, 990, 692);
        const innerPlan = rect(80, 120, 920, 560);
        const selected = selectOldPdfCenterRectangle(
            [pageFrame, innerPlan],
            [hLine(8, 10, 990), hLine(692, 10, 990)],
            width,
            height,
        );

        expect(selected).toEqual(innerPlan);
    });

    it("ignores small inner rooms when choosing the plan", () => {
        const pageFrame = rect(10, 8, 990, 692);
        const smallRoom = rect(400, 280, 520, 400);
        const selected = selectOldPdfCenterRectangle(
            [pageFrame, smallRoom],
            [
                hLine(8, 10, 990),
                hLine(64, 10, 990),
                hLine(600, 10, 990),
                hLine(692, 10, 990),
            ],
            width,
            height,
        );

        expect(selected).toMatchObject({left: 10, right: 990, top: 64, bottom: 600});
    });

    it("insets the page frame when title-block separators are missing", () => {
        const pageFrame = rect(10, 8, 990, 692);
        const selected = selectOldPdfCenterRectangle(
            [pageFrame],
            [hLine(8, 10, 990), hLine(692, 10, 990)],
            width,
            height,
        );

        const inset = (692 - 8) * 0.08;
        expect(selected).toMatchObject({
            left: 10,
            right: 990,
            top: 8 + inset,
            bottom: 692 - inset,
        });
    });

    it("rebuilds the sheet from border lines and stops before a stacked POZICIONI column", () => {
        // Unit plan never closed; only the right-column panels did (Split page-92).
        const position = rect(750, 40, 980, 280);
        const photo = rect(750, 290, 980, 470);
        const areas = rect(750, 480, 980, 640);
        const stacked = rect(750, 40, 980, 640);

        const selected = selectOldPdfCenterRectangle(
            [position, photo, areas, stacked],
            [
                hLine(8, 10, 990),
                hLine(70, 10, 990),
                hLine(290, 750, 980),
                hLine(630, 10, 990),
                hLine(692, 10, 990),
            ],
            width,
            height,
        );

        expect(selected).toMatchObject({
            left: 10,
            right: 750,
            top: 70,
            bottom: 630,
        });
    });

    it("does not promote a lone right-side room to a POZICIONI column", () => {
        const pageFrame = rect(10, 8, 990, 692);
        const innerRoom = rect(700, 80, 960, 280);
        const selected = selectOldPdfCenterRectangle(
            [pageFrame, innerRoom],
            [
                hLine(8, 10, 990),
                hLine(64, 10, 990),
                hLine(600, 10, 990),
                hLine(692, 10, 990),
            ],
            width,
            height,
        );

        expect(selected).toMatchObject({left: 10, right: 990, top: 64, bottom: 600});
    });
});

describe("selectOldPdfTopRightRectangle", () => {
    const width = 1000;
    const height = 700;

    it("picks only the top-right position panel and does not merge the stacked column", () => {
        const unitPlan = rect(40, 80, 620, 620);
        const position = rect(640, 80, 980, 280);
        const photo = rect(640, 290, 980, 470);
        const areas = rect(640, 480, 980, 640);
        const stackedColumn = rect(640, 80, 980, 640);

        const selected = selectOldPdfTopRightRectangle(
            [unitPlan, stackedColumn, position, photo, areas],
            width,
            height,
            unitPlan,
        );

        expect(selected).toEqual(position);
    });

    it("picks the panel that stops at the photo top after center is clipped to the column", () => {
        const unitPlan = rect(10, 70, 750, 630);
        const position = rect(750, 40, 980, 280);
        const photo = rect(750, 290, 980, 470);
        const areas = rect(750, 480, 980, 640);
        const stacked = rect(750, 40, 980, 640);

        const selected = selectOldPdfTopRightRectangle(
            [unitPlan, position, photo, areas, stacked],
            width,
            height,
            unitPlan,
        );

        expect(selected).toEqual(position);
        expect(selected!.bottom).toBeLessThan(photo.top + 1);
    });

    it("ignores the bottom-right areas table", () => {
        const unitPlan = rect(40, 80, 620, 620);
        const areas = rect(640, 480, 980, 640);

        const selected = selectOldPdfTopRightRectangle(
            [unitPlan, areas],
            width,
            height,
            unitPlan,
        );

        expect(selected).toBeNull();
    });

    it("builds the position panel from the photo-top line when that rectangle never closed", () => {
        const unitPlan = rect(40, 80, 620, 620);
        const selected = selectOldPdfTopRightRectangle(
            [unitPlan],
            width,
            height,
            unitPlan,
            [hLine(270, 640, 980)],
        );

        expect(selected).toMatchObject({
            left: 620,
            right: 980,
            top: 80,
            bottom: 270,
        });
    });

    it("does not treat a room inside a full-width floor plan as a position panel", () => {
        const floorPlan = rect(10, 70, 990, 630);
        const innerRoom = rect(700, 80, 960, 280);

        const selected = selectOldPdfTopRightRectangle(
            [floorPlan, innerRoom],
            width,
            height,
            floorPlan,
            [hLine(250, 700, 960)],
        );

        expect(selected).toBeNull();
    });
});

describe("selectOldPdfPositionSchematic", () => {
    it("crops the POZICIONI panel to the right-hand floor schematic", () => {
        const panel = rect(640, 80, 980, 280);
        const selected = selectOldPdfPositionSchematic(
            panel,
            [vLine(810, 80, 280)],
            [hLine(110, 640, 980)],
        );

        expect(selected).toMatchObject({
            left: 810,
            right: 980,
            top: 110,
            bottom: 280,
        });
    });

    it("keeps the full panel when there is no vertical divider", () => {
        const panel = rect(640, 80, 980, 280);
        expect(selectOldPdfPositionSchematic(panel, [], [])).toEqual(panel);
    });
});
