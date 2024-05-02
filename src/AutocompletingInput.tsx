import { List } from "immutable";
import { useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";

function textMatches(text: string, query: string): boolean {
    for (const word of query.split(/\s+/)) {
        if (!text.toLowerCase().includes(word.toLowerCase())) {
            return false;
        }
    }
    return true;
}

export function AutocompletingInput<T>({ options, render, onSubmit, onCancel }: {
    options: List<T>,
    render: (x: T) => string,
    onSubmit: (x: { type: "raw", text: string } | { type: "option", value: T }) => Promise<unknown>,
    onCancel: () => void,
}) {
    const [field, setField] = useState("");
    const [working, setWorking] = useState(false);

    const renderedOptions = useMemo(() => options.map(x => [x, render(x)] as const), [options, render]);

    const inputRef = useRef<HTMLInputElement>(null);
    const completionsRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [focused, setFocused] = useState(false);
    const [popoverHasMouse, setPopoverHasMouse] = useState(false);

    const matches = useMemo(() => {
        return field && field.length > 1 ? renderedOptions.filter(([, text]) => textMatches(text, field)) : renderedOptions.take(0);
    }, [renderedOptions, field]);

    const submit = async (selectedIndex: number | null) => {
        console.log("submit", selectedIndex, field, working);
        if (working) return;
        setWorking(true);
        try {
            if (selectedIndex === null) {
                await onSubmit({ type: "raw", text: field });
            } else {
                const match = matches.get(selectedIndex);
                if (match !== undefined) {
                    await onSubmit({ type: "option", value: match[0] });
                } else {
                    console.error("No match found for selected index", selectedIndex);
                }
            }
            setField("");
            setSelectedIndex(null);
        } finally {
            setWorking(false);
        }
    }
    const goDown = () => {
        setSelectedIndex(selectedIndex === null ? 0 : selectedIndex >= matches.size - 1 ? null : selectedIndex + 1);
    }
    const goUp = () => {
        setSelectedIndex(selectedIndex === null ? matches.size - 1 : selectedIndex <= 0 ? null : selectedIndex - 1);
    }

    return <div className="d-inline-block">
        <div ref={completionsRef} style={{
            top: '-9999px',
            left: '-9999px',
            position: 'absolute',
            zIndex: 1,
            padding: '3px',
            background: 'white',
            borderRadius: '4px',
            boxShadow: '0 1px 5px rgba(0,0,0,.2)',
            visibility: (focused || popoverHasMouse) && !matches.isEmpty() ? 'visible' : 'hidden',
        }}
            onMouseEnter={() => { setPopoverHasMouse(true) }}
            onMouseLeave={() => { setPopoverHasMouse(false) }}
        >
            <small className="text-muted">Select with &uarr;/&darr;, (Shift+)Tab; confirm with &#x23ce;</small>
            <ul className="list-group">
                {matches.map(([, text], i) => <li key={i} className={`list-group-item py-0 ${i === selectedIndex ? 'active' : ''}`}
                    onMouseEnter={() => { setSelectedIndex(i) }}
                    onMouseLeave={() => { if (selectedIndex === i) setSelectedIndex(null) }}
                    onClick={() => { submit(i).catch(console.error) }}
                >
                    <Markdown>{text}</Markdown>
                </li>)}
            </ul>
        </div>
        <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="blocker"
            disabled={working}
            value={field}
            onChange={(e) => {
                setField(e.target.value);
                if (completionsRef.current && inputRef.current) {
                    completionsRef.current.style.top = `${inputRef.current.offsetTop + inputRef.current.offsetHeight}px`;
                    completionsRef.current.style.left = `${inputRef.current.offsetLeft}px`;
                }
            }}
            onFocus={() => { setFocused(true) }}
            onBlur={() => { setFocused(false) }}
            onKeyDown={(e) => {
                if (working) return;
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        goDown();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        goUp();
                        break;
                    case 'Tab':
                        e.preventDefault();
                        if (e.shiftKey) {
                            goUp();
                        } else {
                            goDown();
                        }
                        break;

                    case "Enter":
                        setWorking(true);
                        submit(selectedIndex).catch(console.error);
                        break;
                    case "Escape":
                        setField("");
                        onCancel();
                        break;

                }
            }}
        />
    </div>
}
