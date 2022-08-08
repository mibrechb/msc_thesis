// Define coarse classification data-set
var coarseClassification = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/coarse_classification/zellamsee_input");
var lakeID = coarseClassification.get('lakeID')

// Define timespan from coarse classification properties
var start = ee.Date(coarseClassification.get('system:time_start'))
print('Start date:', start)
var end = ee.Date(coarseClassification.get('system:time_end'))
print('End date:', end)

// *-*-*- Lake Masking with JRC yearly *-*-*-
// Lakemask function
var lakemask = function(point, year){
  var im = jrc
  .filterMetadata('year', 'equals', year)
  .toBands() // convert to image
  //.remap([0,1,2,3], [0,1,3,3]); //combine classes seasonal water and permanent water
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

// Function to convert "system:time_start" to 'YYYY-MM-dd' format and add it to images
var addDate = function(image){
  var date = ee.String((image.date().format('YYYY-MM-dd')))
  return(image.set({date: date}))
}

// Get L8 ImageCollection
var l8_filt = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(roi)
  .filterDate(start, end)
  .map(addDate)

// Get all times from scenes and convert them to date string
var L8_dateList = l8_filt.aggregate_array('date')

// Output usable S-1 imagecollection and available dates
print('Usable L8 Collection:', l8_filt)
print('Available L8 dates:', L8_dateList)

// Sort coarse scene-based classification and remove all labels aside from 'i', 's' and 'w'
var coarseClassification_filt = coarseClassification
  .sort('date')
  .filter(ee.Filter.inList('date', L8_dateList))
  .filter(ee.Filter.inList('classification', ['s', 'i', 'w']))

var coarseClassification_filt_remap = coarseClassification_filt
  .remap(['s','i','w'], [1, 1, 2], 'classification')
  
// Output available coarse classification dates
var coarseClassification_dateList = coarseClassification_filt_remap.aggregate_array('date')
print('Available coarse classification dates:', coarseClassification_dateList)

// Function to find the corresponding coarse classification label for an image
var getClassLabel = function(image){
  // Get image id
  var id = image.id()
  // Find date
  var im_date = ee.String(image.date().format('YYYY-MM-dd'))
  // Match classification label from coarse classification
  var classification = coarseClassification_filt_remap.filterMetadata('date', 'equals', im_date).first().get('classification')
  // Add training Polygon
  var polygon = ee.Feature(lake)
  polygon = polygon.set({class: classification})
  polygon = polygon.set({id: id})
  polygon = polygon.set({lakeID: lakeID})
  return(polygon)
}

// Filter available S-1 images with available coarse classification and find corresponding labels
var training = l8_filt
  .filter(ee.Filter.inList('date', coarseClassification_dateList))
  .map(getClassLabel)

print('Training polygons:', training)

// Export polygons with class and image id to asset storage
Export.table.toAsset({
  collection: ee.FeatureCollection(training),
  description:'exportToTableAssetExample',
  assetId: 'TrSet_L8_x'
  });