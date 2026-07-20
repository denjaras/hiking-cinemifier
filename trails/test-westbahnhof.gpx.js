// TEST ROUTE — Westbahnhof area (Vienna). For field-testing the audio
// state machine near home before the real experiment. Safe to delete later.
//
// POI 1: Maria vom Siege church (plus code 58VQ+74 Wien)
// POI 2: Alaturka Mahü (plus code 58WP+3W Wien)
// The two points are ~225 m apart, well outside each other's
// enter (20 m) / exit (35 m) radii.
window.TRAIL_DATA = window.TRAIL_DATA || [];
window.TRAIL_DATA.push({
  "file": "test-westbahnhof.gpx",
  "name": "TEST — Westbahnhof",
  "description": "Test route near Wien Westbahnhof: walk between Maria vom Siege and Alaturka Mahü to verify enter/stay/exit audio triggering. Delete this entry after testing.",
  "pois": [
    { "lat": 48.1931875, "lng": 16.3378125, "name": "TEST 1: Maria vom Siege", "audio": "audio/01. Lion King - This Land.mp3" },
    { "lat": 48.1951875, "lng": 16.3373125, "name": "TEST 2: Alaturka Mahü", "audio": "audio/09. La La Land - Credits.mp3" }
  ],
  "gpx": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<gpx xmlns=\"http://www.topografix.com/GPX/1/1\" version=\"1.1\" creator=\"manual\">\n<trk>\n<name>TEST — Westbahnhof</name>\n<trkseg>\n<trkpt lat=\"48.1931875\" lon=\"16.3378125\"></trkpt>\n<trkpt lat=\"48.1951875\" lon=\"16.3373125\"></trkpt>\n</trkseg>\n</trk>\n</gpx>"
});
