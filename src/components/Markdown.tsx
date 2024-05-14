import Typography from "@mui/material/Typography/Typography";
import RawMarkdown, { Options } from "react-markdown";

export function Markdown(props: Options): JSX.Element {
    const fullProps: Options = {
        ...props,
        components: {
            ...props.components,
            p: ({ children }) => <Typography>{children}</Typography>,
        },
    };
    return <RawMarkdown {...fullProps} />
}

export function SingleLineMarkdown(props: Options): JSX.Element {
    const fullProps: Options = {
        ...props,
        allowedElements: ['a', 'strong', 'em', 'code', 'del'],
        unwrapDisallowed: true,
    };
    return <Typography><RawMarkdown {...fullProps} /></Typography>
}