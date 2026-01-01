import { TagData } from "components/types/tags";
import { useRef } from "react";

interface TagInputProps {
    label: string;
    suggestions: TagData[];
    onChange: (value: string) => void;
}

const TagInput: React.FC<TagInputProps> = ({ label, suggestions, onChange }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const demoRef = useRef<HTMLDivElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        onChange(value);
        const filtered = suggestions.filter(s => s.tag_name.includes(value));
        demoRef.current!.innerHTML = '';
        filtered.forEach(s => {
            const a = document.createElement('a');
            a.textContent = s.tag_name;
            a.onclick = () => { e.target.value = s.tag_name; demoRef.current!.innerHTML = ''; };
            demoRef.current!.appendChild(a);
        });
    }

    return (
        <div className="tag-input">
            <p>{label}</p>
            <input ref={inputRef} type="text" onChange={handleChange} />
            <div ref={demoRef} className="suggestions" />
        </div>
    );
};

export { TagInput }