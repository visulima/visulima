import Option from "./option";

class FlagOption extends Option {
    set(value: any): void {
        super.set(true);
    }

    static create(def: any): FlagOption {
        return new this(def);
    }
}

export default FlagOption;
