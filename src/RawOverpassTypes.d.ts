type BaseOverpassElement = {
    id: number;
    timestamp: string;
    changeset: number;
    uid: number;
    user: string;
    version: number;
}

export type RawNodeOverpassElement = BaseOverpassElement & {
    type: 'node';
    lat: number;
    lon: number;
    tags?: { [key: string]: string };
}

export type RawWayOverpassElement = BaseOverpassElement & {
    type: 'way';
    tags: { [key: string]: string };
    nodes: number[];
}

export type RawRelationOverpassElement = BaseOverpassElement & {
    type: 'relation';
    tags: { [key: string]: string };
    members: ({ type: string, ref: number, role: string })[],
}

export type RawOverpassElement = RawNodeOverpassElement | RawWayOverpassElement | RawRelationOverpassElement;
