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

interface BaseOptions {
    backgroundColor?: (text: string) => string;
    borderColor?: (border: string, position: "bottom" | "left" | "right" | "top") => string;
    float?: "center" | "left" | "right";
    footerText?: string;
    footerTextColor?: (text: string) => string;
    fullscreen?: boolean | ((width: number, height: number) => { columns: number; rows: number });
    headerText?: string;
    headerTextColor?: (text: string) => string;
    height?: number;
    width?: number;
}

export interface Options extends BaseOptions {
    borderStyle?: BorderStyle | string;
    footerAlignment?: "center" | "left" | "right";
    headerAlignment?: "center" | "left" | "right";
    margin?: Spacer | number;
    padding?: Spacer | number;
    textAlignment?: "center" | "left" | "right";
}

export interface DimensionOptions extends BaseOptions {
    borderStyle: BorderStyle | string;
    footerAlignment: "center" | "left" | "right";
    headerAlignment: "center" | "left" | "right";
    margin: Spacer;
    padding: Spacer;
    textAlignment: "center" | "left" | "right";
}
