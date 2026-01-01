
type Props = {
    v: string;
    type: string;
};

export default function TagLink({type, v }: Props) {

    return (
        <a
            data-type={type}
            href={`/main/image_area?tag=${v}&page=1&group=${type}`}
        >
            {v}
        </a>
    );
}
