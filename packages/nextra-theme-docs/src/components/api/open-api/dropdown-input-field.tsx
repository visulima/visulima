const DropdownInputField = ({ name, options, ...props }) => {
    return (
        <div className="relative">
            <select
                className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
                id={name}
                name={name}
                {...props}
            >
                {options.map((option) => (
                    <option value={option.value}>{option.label}</option>
                ))}
            </select>
        </div>
    );
};

export default DropdownInputField;
