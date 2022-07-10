import { FC, useRef, useState } from 'react';
import { PORT } from '../constants';
import { Map } from './Map';
import { RawOverpassElement } from './RawOverpassTypes';
import { NodeData, TransformedOverpassElement, TransformedWayOverpassElement } from './TransformedOverpassTypes';

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
    const [rawElements, setRawElements] = useState<RawOverpassElement[]>([]);
    const [transformedElements, setTransformedElements] = useState<TransformedOverpassElement[]>([]);
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

    const handleIcaoFetch = (value: string, forceFresh: boolean) => {
        if (value.length !== 4) return;

        setRawElements([]);
        setWaiting(true);

        fetch(`http://localhost:${PORT}/?search=${generateQuery(value.toUpperCase())}&icao=${value.toUpperCase()}&forceFresh=${forceFresh}`).then((res) => res.json())
            .then((json: { elements: RawOverpassElement[] }) => {
                setTransformedElements(json.elements as unknown as TransformedOverpassElement[]);
                setWaiting(false);

                const map = new window.Map<number, NodeData>();

                for (const element of json.elements) {
                    if (element.type === 'node') {
                        map.set(element.id, { location: { lat: element.lat, long: element.lon }, tags: element.tags });
                    }
                }

                const ways = json.elements.filter((element) => element.type === 'way');

                for (const way of ways) {
                    if (way.type === 'way') {
                        (way as unknown as TransformedWayOverpassElement).nodes = way.nodes.map((nodeId) => map.get(nodeId as number));
                    }
                }

                const [{ location: { lat, long } }] = map.values();
                parseAndAssignNumber((lat + Math.random() / 1000).toString(), setPlaneLatitude);
                parseAndAssignNumber((long + Math.random() / 1000).toString(), setPlaneLongitude);
            });
    };

    const parseAndAssignNumber = (value: string, setter: (value: number) => void): void => {
        if (!value.length) return;
        const sanitized = value.replace(/^![0-9.,]+$/g, '');

        setter(parseFloat(sanitized));
    };

    const generateQuery = (icao: string): string => {
        const params = ['"aeroway"="holding_position"', '"aeroway"="aerodome"', '"aeroway"="apron"', '"aeroway"="gate"', '"aeroway"="hangar"', '"aeroway"="holding_position"',
            '"aeroway"="parking_position"', '"aeroway"="runway"', '"aeroway"="taxilane"', '"aeroway"="taxiway"', '"aeroway"="terminal"',
            '"aeroway"="tower"', '"building"', '"man_made"="tower"', '"airside"="yes"', '"highway"="service"'];
        let query = '';
        for (const param of params) {
            query += `node[${param}](area.searchArea);way[${param}](area.searchArea);relation[${param}](area.searchArea);`;
        }

        return `[out:json][maxsize:2000000000];area[icao~"${icao}"]->.searchArea;(${query});(._;>;);out meta;(._;>;);out meta qt;`;
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="flex flex-row flex-wrap p-4 border-b justify-between">
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

                                    handleIcaoFetch(inputRef.current.value, false);
                                }}
                            >
                                Go
                            </button>
                            <button
                                id="icao-input"
                                type="submit"
                                onClick={(e) => {
                                    e.preventDefault();

                                    handleIcaoFetch(inputRef.current.value, true);
                                }}
                            >
                                Go (Fresh)
                            </button>
                        </form>
                    </div>

                    <div className="flex flex-row rounded-sm overflow-hidden">
                        {viewOptions.map((option) => (
                            <div
                                className={`px-4 cursor-pointer h-full ${option.value === dataView ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'} transition duration - 100`}
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
                            {rawElements.filter((node) => node.type.includes(searchQuery)).map((node) => (<FormattedObject object={node} />))}
                        </div>
                    </div>
                )}

                {(dataView === 'map' || dataView === 'both') && (
                    <Map elements={transformedElements} longitude={planeLongitude} latitude={planeLatitude} heading={planeHeading} />
                )}
            </div>
        </div>
    );
};
