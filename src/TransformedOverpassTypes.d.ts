import { Coordinates } from 'msfs-geo';
import { RawRelationOverpassElement } from './RawOverpassTypes';

type BaseOverpassElement = {
    type: string,
    id: number;
    timestamp: string;
    changeset: number;
    uid: number;
    user: string;
    version: number;
}

type NodeData = {
    location: Coordinates;
    tags: { [key: string]: string };
}

export type TransformedWayOverpassElement = BaseOverpassElement & {
    type: 'way';
    tags: { [key: string]: string };
    nodes: NodeData[];
}

// FIXME TODO: I literally have no idea what to do about relations. Are they transformed already? Are they still raw? Oh well... that's someone elses problem 🤗.
export type TransformedOverpassElement = TransformedWayOverpassElement | RawRelationOverpassElement;
