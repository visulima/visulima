const DropdownInputField = ({ name, options, ...properties }) => (
    <div className="relative">
        <select
            className="focus:shadow-outline block w-full appearance-none rounded border border-gray-300 bg-white px-4 py-2 pr-8 leading-tight shadow hover:border-gray-400 focus:outline-none"
            id={name}
            name={name}
            {...properties}
        >
            {options.map((option) => (
                <option value={option.value}>{option.label}</option>
            ))}
        </select>
    </div>
);

export default DropdownInputField;
