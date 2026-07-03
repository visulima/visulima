const copyDate = <Value extends Date>(date: Value): Value => new Date(date) as Value;

export default copyDate;
