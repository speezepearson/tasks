import Markdown, { Options } from "react-markdown";

export function SingleLineMarkdown(props: Options): JSX.Element {
    const fullProps: Options = {
        ...props,
        components: {
            ...props.components,
            p: ({ children }) => <span>{children}</span>,
        },
    };
    return <Markdown {...fullProps} />
}