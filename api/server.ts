import express = require('express');
import fetch from 'node-fetch';
import { PORT } from '../constants';

const app = express();
const cacheMap = new Map<string, Record<string, any>>();

app.use((_, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // @ts-ignore
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});

app.get('/', (req, res) => {
    const searchQuery = req.query.search as string;
    const forceFresh = req.query.forceFresh as string;
    const cacheHit = cacheMap.get(searchQuery);

    if (cacheHit && !forceFresh) {
        res.send(cacheHit);
    } else {
        fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: searchQuery,
            headers: { 'Content-Type': 'application/xml' },
        }).then((data) => data.json()).then((json) => {
            cacheMap.set(searchQuery, json);
            res.send(json);
        });
    }
});

app.listen(PORT);
