import { FC, useRef, useState } from 'react';

// eslint-disable-next-line max-len
const overpassRequestBodyForIcao = (icao: string) => `[out:json]/*fixed by auto repair*/[timeout:25];\r\n// fetch area “airport” to search in\r\narea[icao~"${icao}"]->.searchArea;\r\n// gather results\r\n(\r\n  // query part for: “taxiway”\r\n  node["aeroway"="taxiway"](area.searchArea);\r\n  way["aeroway"="taxiway"](area.searchArea);\r\n  relation["aeroway"="taxiway"](area.searchArea);\r\n\r\n);\r\n// print results\r\nout meta;/*fixed by auto repair*/\r\n>;\r\nout meta qt;/*fixed by auto repair*/\r\n`;

export const Query: FC = () => {
    const inputRef = useRef<HTMLInputElement>();
    const [nodes, setNodes] = useState([]);
    const [isWaiting, setWaiting] = useState(false);

    const handleIcaoFetch = (value: string) => {
        if (value.length !== 4) return;

        value = value.toUpperCase();

        setNodes([]);
        setWaiting(true);

        fetch(
            'https://overpass-api.de/api/interpreter',
            {
                method: 'POST',
                body: overpassRequestBodyForIcao(value),
                headers: { 'Content-Type': 'application/xml' },
            },
        ).then((data) => data.json())
            .then((json) => {
                setNodes(json.elements.filter((element) => 'tags' in element));
                setWaiting(false);
            });
    };

    return (
        <div>
            <div className="flex flex-col gap-y-2">
                <h1 className="font-semibold">Query</h1>

                <span className="flex gap-x-2">
                    <h2>ICAO</h2>
                    <form>
                        <input ref={inputRef} type="text" />
                        <button
                            id="icao-input"
                            type="submit"
                            onClick={(e) => {
                                e.preventDefault();

                                handleIcaoFetch(inputRef.current.value);
                            }}
                        >
                            Go
                        </button>
                    </form>
                </span>
            </div>

            <hr />

            {isWaiting && (
                <h1>Fetching data...</h1>
            )}

            {nodes.map((node) => (
                <pre>{JSON.stringify(node)}</pre>
            ))}
        </div>
    );
};
