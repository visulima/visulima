import Pre from "../../pre";
import Code from "../../code";

const ResponseView = ({ response }) => (
    <Pre
        classNames={{
            pre: "overflow-auto",
        }}
        header={
            <div className="mt-2 flex flex-auto flex-col justify-items-end gap-4 rounded-tl border border-slate-500/30 bg-slate-700/50 px-4 py-1 text-sm text-white/75">
                test
            </div>
        }
        filename="Response"
    >
        <Code />
    </Pre>
);

export default ResponseView;
