// Load coarse classification
var classification_coarse = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/coarse_classification/schwaigerhaus_input')

// Define timespan
var start = ee.Date('2018-06-01');
var end = ee.Date('2018-10-19');
// Define maximal allowed cloud probability
var MAX_CLOUD_PROBABILITY = 65;
// Use these bands for image display.
var bands = ['B2', 'B3', 'B4', 'B8'];

// *-*-*- Lake Masking with JRC yearly *-*-*-
// Lakemask function
var lakemask = function(point, year){
  var im = jrc
  .filterMetadata('year', 'equals', year)
  .toBands() // convert to image
  .remap([0,1,2,3], [0,1,3,3]); //combine classes seasonal water and permanent water
  // Use reducer to convert raster to vector.
  var mask = im.reduceToVectors({
    geometry: point.buffer(40000),
    geometryType: 'polygon',
    eightConnected: true,
  })
  .filterBounds(point)
  .first();
  var lake = mask.geometry();
  return(lake);
};
// Get Lakemask
var lake = lakemask(roi, 2019);
Map.addLayer(lake, {color:'red'}, 'Lakemask')
// *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-

// Remove original mask to reduce missing pixels
function unmask(img){
  return(img.unmask())
}
s2Sr = s2Sr.map(unmask)

// *-*-*- Cloud Masking with s2cloudless dataset *-*-*-
// Cloudmask function
function maskClouds(img) {
  var clouds = ee.Image(img.get('cloud_mask')).select('probability');
  var isNotCloud = clouds.lt(MAX_CLOUD_PROBABILITY);
  return img.updateMask(isNotCloud);
}
// The masks for the 10m bands sometimes do not exclude bad data at
// scene edges, so we apply masks from the 20m and 60m bands as well.
function maskEdges(s2_img) {
  return s2_img.updateMask(
      s2_img.select('B8A').mask().updateMask(s2_img.select('B9').mask()));
}
// Join S2 SR with cloud probability dataset to add cloud mask.
var s2SrWithCloudMask = ee.Join.saveFirst('cloud_mask').apply({
  primary: s2Sr,
  secondary: s2Clouds,
  condition:
      ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
});
// Map the maskClouds function to mask out clouds above threshold
var s2CloudMasked =
    ee.ImageCollection(s2SrWithCloudMask).map(maskClouds);
// *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-

// Get S-2 Image Collection.
var images = s2CloudMasked
  .filterBounds(roi)
  .filterDate(start, end)
  .select(bands)
  //.map(addIndices);
  
var images = images.map(function(feature){
  feature = feature.clip(lake);
  var count = feature.reduceRegion(ee.Reducer.count()).values().get(0)
  feature = feature.set('validPixels', count);
  return(feature);
});

// Output S-2 imagecollection
print('S-2 Collection:', images)

// Set a minimal threshold area of 25% of the lake size and filter images below threshold
var minPxTresh = lake.area(10).divide(100).multiply(0.25)
print('Min pixel treshold:', minPxTresh)
var images = images.filterMetadata('validPixels', 'greater_than', minPxTresh);

// Output usable S-2 imagecollection
print('Usable Collection:', images)

// Sort coarse scene-based classification
// Output coarse classificaiton table
classification_coarse = classification_coarse.sort('date')
print('Coarse classification:', classification_coarse)

// Create training-polygon featurecollection
var training = ee.FeatureCollection([])

// Add Layers to map.
// Visualization parameters
var i = 0;
var vis = {bands:['B4', 'B3', 'B2'], min:0, max:10000, gamma:4};
var image = images.first()
Map.addLayer(image, vis, "Sentinel-2 Image");
//Map.addLayer(lake, {color:'red', opacity:0.2}, 'Lake Mask');

// Get image ID from server-side to local
var id = image.id().getInfo()

// Find the corresponding coarse classification label for image
var findLabel = function(feature){
  var im_date = image.date().format('YYYY-MM-dd')
  var classification = classification_coarse.filterMetadata('date', 'equals', im_date)
  return classification.first().get('classification').getInfo()
}

// Find the corresponding notes for image
var findNotes = function(feature){
  var im_date = image.date().format('YYYY-MM-dd')
  var classification = classification_coarse.filterMetadata('date', 'equals', im_date)
  return classification.first().get('notes').getInfo()
}

// Remove masked pixels from training polygon
var maskPolygon = function(feature){
  var mask = feature.difference(lake,1)
  return(feature.difference(mask, 1).set({id: id}))
}

// Make widgets
var button_next = ui.Button('Next Image');
var button_save = ui.Button('Save Polygons');
var button_saveSet = ui.Button('Save Trainings Set');
var im_id = ui.Label(id);
var im_class = ui.Label('Coarse Classification: ' + findLabel(image))
var im_notes = ui.Label('Notes: ' + findNotes(image))

// Create a panel to hold the widgets
var panel = ui.Panel();
panel.style().set({
  width: '400px',
  position: 'bottom-right'
});

// Add widgets to panel
panel.widgets().set(1, im_id);
panel.widgets().set(2, im_class);
panel.widgets().set(3, im_notes);
panel.widgets().set(4, button_next);
panel.widgets().set(5, button_save);
panel.widgets().set(6, button_saveSet);

// Button click: Next Image
button_next.onClick(function() {
  Map.clear();
  var date = ee.Date(image.get('system:time_start'));
  date = date.advance(1, 'second');
  image = images.filterDate(date, end).first();
  id = image.id().getInfo();
  im_id.setValue(id);
  im_class.setValue('Coarse Classification: ' + findLabel(image));
  im_notes.setValue('Notes: ' + findNotes(image));
  Map.addLayer(image, vis, "Sentinel-2 Image");
  Map.add(panel);
});

// Button click: Save Polygons
button_save.onClick(function() {
  var polygons = Map.drawingTools().toFeatureCollection('class')
  polygons = polygons.filterMetadata('class', 'not_equals', 0)
  polygons = polygons.map(maskPolygon)
  training = training.merge(polygons)
  print(training)
});

// Button click: Save Training Set
button_saveSet.onClick(function() {
  Export.table.toAsset({
  collection: ee.FeatureCollection(training),
  description:'exportToTableAssetExample',
  assetId: 'TrSet_S2_zellamsee_20200101_20200501'
  });
});

// Add the panel to the map
Map.add(panel);
Map.centerObject(roi, 15)
