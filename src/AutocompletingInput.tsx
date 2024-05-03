import { List } from "immutable";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { ReqStatus, textMatches, watchReqStatus } from "./common";

export function AutocompletingInput<T>({ options, render, onSubmit, onCancel }: {
    options: List<T>,
    render: (x: T) => string,
    onSubmit: (x: { type: "raw", text: string } | { type: "option", value: T }) => Promise<unknown>,
    onCancel: () => void,
}) {
    const [field, setField] = useState("");
    const [req, setReq] = useState<ReqStatus>({ type: "idle" });
    useEffect(() => {
        if (req.type === 'error') alert(req.message);
    }, [req]);

    const renderedOptions = useMemo(() => options.map(x => [x, render(x)] as const), [options, render]);

    const inputRef = useRef<HTMLInputElement>(null);
    const completionsRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [focused, setFocused] = useState(false);
    const [popoverHasMouse, setPopoverHasMouse] = useState(false);

    const matches = useMemo(() => {
        return field && field.length > 1 ? renderedOptions.filter(([, text]) => textMatches(text, field)) : renderedOptions.take(0);
    }, [renderedOptions, field]);

    const submit = (selectedIndex: number | null) => {
        if (req.type === 'working') return;
        watchReqStatus(setReq, (async (): Promise<void> => {
            if (selectedIndex === null) {
                await onSubmit({ type: "raw", text: field })
                setField("");
                setSelectedIndex(null);
            } else {
                const match = matches.get(selectedIndex);
                if (match !== undefined) {
                    await onSubmit({ type: "option", value: match[0] })
                    setField("");
                    setSelectedIndex(null);
                } else {
                    setReq({ type: "error", message: "No match found for selected index" });
                }
            }
        })()).catch(console.error);
    };
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
                    onClick={() => { submit(i) }}
                >
                    <Markdown>{text}</Markdown>
                </li>)}
            </ul>
        </div>
        <input
            ref={inputRef}
            autoFocus
            className="form-control form-control-sm d-inline-block"
            type="text"
            placeholder="blocker"
            disabled={req.type === 'working'}
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
                if (req.type === 'working') return;
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
                        submit(selectedIndex);
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
