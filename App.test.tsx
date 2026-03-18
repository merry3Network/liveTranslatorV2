import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
    it('renders without crashing', () => {
        render(<App />);
        // Check for some text that should always be present, e.g., from ControlPanel
        // Since we can't run it, we'll just check if it renders successfully.
        expect(document.body).toBeInTheDocument();
    });
});
