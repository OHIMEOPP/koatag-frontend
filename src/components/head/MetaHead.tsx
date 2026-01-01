import { Helmet } from 'react-helmet';
interface MetaHeadProps {
    title?: string;
    description?: string;
    favicon?: string;
}

const MetaHead = ({ title = 'KOATAG', description = '', favicon = '/favicon.ico' }: MetaHeadProps) => {
    return (
        <>
            <Helmet>
                <title>{title}</title>
                <meta charSet="utf-8" />
                <meta name="description" content={description} />
                <link rel="icon" href={favicon} />
            </Helmet>
        </>
    );
}

export { MetaHead };