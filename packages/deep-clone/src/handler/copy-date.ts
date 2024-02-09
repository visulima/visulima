const copyDate = <Value extends Date>(date: Value): Value => new Date(date.getTime()) as Value;

export default copyDate;
