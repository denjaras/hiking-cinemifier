// TEST ROUTE — Westbahnhof area (Vienna). For field-testing the audio
// state machine near home before the real experiment. Safe to delete later.
//
// POI 1: Maria vom Siege church (plus code 58VQ+74 Wien) — hard to approach
//        in person (known hangout spot), kept only as a GPS trigger test.
// POI 2: Alaturka Mahü (plus code 58WP+3W Wien)
// POI 3: plus code 58WP+CM Wien — added as an easier-to-approach alternative
//        near POI 1, ~300 m from it.
window.TRAIL_DATA = window.TRAIL_DATA || [];
window.TRAIL_DATA.push({
  "file": "test-westbahnhof.gpx",
  "name": "TEST — Westbahnhof",
  "description": "Test route near Wien Westbahnhof: walk between the test POIs to verify enter/stay/exit audio triggering. Delete this entry after testing.",
  "pois": [
    { "lat": 48.1931875, "lng": 16.3378125, "name": "TEST 1: Maria vom Siege", "audio": "audio/01. Lion King - This Land.mp3" },
    { "lat": 48.1951875, "lng": 16.3373125, "name": "TEST 2: Alaturka Mahü", "audio": "audio/09. La La Land - Credits.mp3" },
    { "lat": 48.1960625, "lng": 16.3366875, "name": "TEST 3: 58WP+CM Wien", "audio": "audio/11. Interstellar - Day One.mp3" }
  ],
  "gpx": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<gpx xmlns=\"http://www.topografix.com/GPX/1/1\" version=\"1.1\" creator=\"manual\">\n<trk>\n<name>TEST — Westbahnhof</name>\n<trkseg>\n<trkpt lat=\"48.1931875\" lon=\"16.3378125\"></trkpt>\n<trkpt lat=\"48.1951875\" lon=\"16.3373125\"></trkpt>\n<trkpt lat=\"48.1960625\" lon=\"16.3366875\"></trkpt>\n</trkseg>\n</trk>\n</gpx>"
});
