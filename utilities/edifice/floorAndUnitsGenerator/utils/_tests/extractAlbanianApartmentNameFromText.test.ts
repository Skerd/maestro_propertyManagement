import {describe, expect, it} from "vitest";
import {extractAlbanianApartmentNameFromText} from "../albanianUnitName";

describe("extractAlbanianApartmentNameFromText", () => {
    it("parses SPLIT footer titles with KATI before APARTAMENTI", () => {
        const text = [
            '"SPLIT" GODINË BANIMI, SHËRBIMI DHE HOTELERIE 22 dhe 24 KATE MBI TOKË DHE 5 KATE NËNTOKË ALBUM SHITJESH',
            'SIPËRFAQE NETO: 84.74 m 2',
            'NJËSI BANIMI KATI 3 APARTAMENTI A06_ KUOTA +14.22',
            'ARTECH STUDIO SHPK 1:40',
        ].join('\n');

        expect(extractAlbanianApartmentNameFromText(text)).toBe('A-06 Floor 3');
    });

    it("still parses APARTAMENTI before KATI", () => {
        expect(extractAlbanianApartmentNameFromText('APARTAMENTI A-13 KATI 2')).toBe('A-13 Floor 2');
        expect(extractAlbanianApartmentNameFromText('APARTAMENTI A02 KATI 4')).toBe('A-02 Floor 4');
    });

    it("does not invent a unit name from a floor-only title", () => {
        expect(extractAlbanianApartmentNameFromText('KATI 4_KUOTA +17.64')).toBeNull();
    });
});
