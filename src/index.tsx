import React, { FC } from 'react';
import { createRoot } from 'react-dom/client';
import { Query } from './Query';

const App: FC = () => (
    <Query />
);

createRoot(document.getElementById('root')).render(<App />);
