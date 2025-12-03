export type Alignment = "center" | "left" | "right";

export type BorderPosition = "bottom" | "bottomLeft" | "bottomRight" | "horizontal" | "left" | "right" | "top" | "topLeft" | "topRight";

export interface BaseOptions {
    borderColor?: (border: string, position: BorderPosition, length: number) => string;
    float?: Alignment;
    footerText?: string;
    footerTextColor?: (text: string) => string;
    fullscreen?: boolean | ((width: number, height: number) => { columns: number; rows: number });
    headerText?: string;
    headerTextColor?: (text: string) => string;
    height?: number;
    textColor?: (text: string) => string;
    transformTabToSpace?: number | false;
    width?: number;
}

export type Spacer = {
    bottom: number;
    left: number;
    right: number;
    top: number;
};

export interface BorderStyle {
    bottom?: string;
    bottomLeft?: string;
    bottomRight?: string;
    horizontal?: string;
    left?: string;
    right?: string;
    top?: string;
    topLeft?: string;
    topRight?: string;
    vertical?: string;
}

export interface Options extends BaseOptions {
    borderStyle?: BorderStyle | "arrow" | "bold" | "classic" | "double" | "doubleSingle" | "none" | "round" | "single" | "singleDouble";
    footerAlignment?: Alignment;
    headerAlignment?: Alignment;
    margin?: Partial<Spacer> | number;
    padding?: Partial<Spacer> | number;
    textAlignment?: Alignment;
}

export interface DimensionOptions extends BaseOptions {
    borderStyle: BorderStyle | string;
    footerAlignment: Alignment;
    headerAlignment: Alignment;
    margin: Spacer;
    padding: Spacer;
    textAlignment: Alignment;
}
