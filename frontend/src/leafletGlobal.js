// Geoman's published bundle is a browser-global plugin build: it reads Leaflet
// from a bare `L` global instead of importing it (webpack externals: {leaflet:'L'}).
// Leaflet's own UMD does set `window.L`, but that is a side effect we should not
// depend on. Publish it explicitly here, and import this module BEFORE
// '@geoman-io/leaflet-geoman-free' (see MapView.jsx) so `L.PM.initialize()` has a
// Leaflet to attach to.
import L from 'leaflet';

if (typeof window !== 'undefined') window.L = L;

export default L;
