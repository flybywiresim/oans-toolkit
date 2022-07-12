// SI base units
export type Celsius = number; // derived unit
export type HectoPascal = number; // derived unit
export type KiloGram = number;
export type Metre = number;
export type Litre = number;

// USCS base units
export type Fahrenheit = number;
export type Foot = number;
export type NauticalMile = number;
export type Pound = number;
export type Gallon = number;

export type InchOfMercury = number;

export class Units {
    static poundToKilogram(value: Pound): KiloGram {
        return value * 0.4535934;
    }

    static kilogramToPound(value: KiloGram): Pound {
        return value / 0.4535934;
    }

    static footToMetre(value: Foot): Metre {
        return value / 3.28084;
    }

    static footToNauticalMile(value: Foot): NauticalMile {
        return value * 0.000164579;
    }

    static metreToFoot(value: Metre): Foot {
        return value * 3.28084;
    }

    static nauticalMileToMetre(value: NauticalMile): Metre {
        return value * 1852;
    }

    static metreToNauticalMile(value: Metre): NauticalMile {
        return value / 1852;
    }

    static fahrenheitToCelsius(value: Fahrenheit): Celsius {
        return (value - 32) * (5 / 9);
    }

    static celsiusToFahrenheit(value: Celsius): Fahrenheit {
        return (value * (9 / 5)) + 32;
    }

    static inchOfMercuryToHectopascal(value: InchOfMercury): HectoPascal {
        return value * 33.863886666667;
    }

    static hectopascalToInchOfMercury(value: HectoPascal): InchOfMercury {
        return value / 33.863886666667;
    }

    static gallonToLitre(value: number): Litre {
        return value * 3.78541;
    }

    static litreToGallon(value: number): Gallon {
        return value / 3.78541;
    }
}
