const getPackageName = (id = ""): string => {
    const s = id.split("/");

    return (s[0][0] === "@" ? `${s[0]}/${s[1]}` : s[0]) as string;
};

export default getPackageName;
