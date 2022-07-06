import { Coordinates } from 'msfs-geo';
import { FC, useRef, useState } from 'react';
import { Map } from './Map';

type BaseOverpassElement = {
    id: number;
    timestamp: string;
    changeset: number;
    uid: number;
    user: string;
    version: number;
}

export type OverpassElement =
    (BaseOverpassElement & {
        type: 'way';
        tags: { [key: string]: string };
        nodes: (number | Coordinates)[];
    }) | (BaseOverpassElement & {
        type: 'node';
        lat: number;
        lon: number;
    })

const FormattedObject = ({ object }: { object: Record<string, any> }) => (
    <>
        <p className="font-bold">{'{'}</p>
        {Object.entries(object).map(([key, value]) => (
            <p className="ml-8 break-all">
                <span className="text-purple-700 font-medium">
                    {key}
                    :
                    {' '}
                </span>
                <span>{JSON.stringify(value)}</span>
            </p>
        ))}
        <p className="font-bold">{'}'}</p>
    </>
);

export const Query: FC = () => {
    const inputRef = useRef<HTMLInputElement>();
    const [elements, setElements] = useState<OverpassElement[]>([]);
    const [isWaiting, setWaiting] = useState(false);

    const [planeLatitude, setPlaneLatitude] = useState(0);
    const [planeLongitude, setPlaneLongitude] = useState(0);
    const [planeHeading, setPlaneHeading] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    const viewOptions = [
        { name: 'DATA', value: 'data' },
        { name: 'MAP', value: 'map' },
        { name: 'BOTH', value: 'both' },
    ];
    const [dataView, setDataView] = useState(viewOptions[0].value);

    const handleIcaoFetch = (value: string) => {
        if (value.length !== 4) return;

        setElements([]);
        setWaiting(true);

        fetch(
            'https://overpass-api.de/api/interpreter',
            {
                method: 'POST',
                body: generateQuery(value.toUpperCase()),
                headers: { 'Content-Type': 'application/xml' },
            },
        ).then((data) => data.json())
            .then((json: { elements: OverpassElement[] }) => {
                setElements(json.elements);
                setWaiting(false);

                const map = new window.Map<number, Coordinates>();

                for (const element of json.elements) {
                    if (element.type === 'node') {
                        map.set(element.id, { lat: element.lat, long: element.lon });
                    }
                }

                const ways = json.elements.filter((element) => element.type === 'way');

                for (const way of ways) {
                    if (way.type === 'way') {
                        way.nodes = way.nodes.map((nodeId) => map.get(nodeId as number));
                    }
                }

                const [{ lat, long }] = map.values();
                parseAndAssignNumber(lat.toString(), setPlaneLatitude);
                parseAndAssignNumber(long.toString(), setPlaneLongitude);
            });
    };

    const parseAndAssignNumber = (value: string, setter: (value: number) => void): void => {
        if (!value.length) return;
        const sanitized = value.replace(/^![0-9.,]+$/g, '');

        setter(parseFloat(sanitized));
    };

    const generateQuery = (icao: string): string => {
        const params = ['aerodome', 'apron', 'gate', 'hangar', 'holding_position', 'parking_position', 'runway', 'taxilane', 'taxiway', 'terminal', 'tower'];
        let query = '';
        for (const param of params) {
            query += `node["aeroway"="${param}"](area.searchArea);way["aeroway"="${param}"](area.searchArea);relation["aeroway"="${param}"](area.searchArea);`;
        }
        return `[out:json];area[icao~"${icao}"]->.searchArea;(${query});out meta;out meta qt;`;
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex flex-row p-4 border-b justify-between">
                <div className="flex flex-row gap-x-3">
                    <div className="flex gap-x-2">
                        <h1 className="text-xl">ICAO</h1>
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
                    </div>

                    <div className="flex flex-row rounded-sm overflow-hidden">
                        {viewOptions.map((option) => (
                            <div
                                className={`px-4 cursor-pointer h-full ${option.value === dataView ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'} transition duration-100`}
                                onClick={() => setDataView(option.value)}
                            >
                                {option.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-row gap-x-2">
                    <input type="text" placeholder="Latitude" value={planeLatitude} onChange={(e) => parseAndAssignNumber(e.target.value, setPlaneLatitude)} />
                    <input type="text" placeholder="Longitude" value={planeLongitude} onChange={(e) => parseAndAssignNumber(e.target.value, setPlaneLongitude)} />
                    <input type="text" placeholder="Heading" value={planeHeading} onChange={(e) => parseAndAssignNumber(e.target.value, setPlaneHeading)} />
                </div>
            </div>

            {isWaiting && (
                <h1>Fetching data...</h1>
            )}

            <div className="flex flex-row p-2 h-screen">
                {(dataView === 'data' || dataView === 'both') && (
                    <div className="h-full overflow-y-scroll">
                        <div className="p-2 fixed">
                            <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="mt-12">
                            {elements.filter((node) => node.type.includes(searchQuery)).map((node) => (<FormattedObject object={node} />))}
                        </div>
                    </div>
                )}

                {(dataView === 'map' || dataView === 'both') && (
                    <Map elements={elements} longitude={planeLongitude} latitude={planeLatitude} heading={planeHeading} />
                )}
            </div>
        </div>
    );
};
