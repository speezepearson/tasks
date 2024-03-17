export type Props = {
    id: string
}

export function Page({ id } : Props) {
    return (
        <div>
            Looking at thingy {id}
        </div>
    )
}