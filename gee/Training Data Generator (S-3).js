exports.getTrainingPixels = function(filename){
  // Load training data
  var tr_polygons = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/training_sets/'+filename)
  //print('Training Set:', tr_polygons)

  // Load S3 Toolbox and General Toolbox
  var s3Tools = require('users/michaelbrechbuehler/msc_thesis:S-3 Toolbox')
  var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')
  
  // Get list of scenes used for training
  var id_list = tr_polygons.aggregate_array('id').distinct().sort()//.slice(800, 1000) //(0, 200)//(200, 400)//(400, 600)//(600, 800)//(800, 1000)
  print('ID List:', id_list)
  
  // Use these bands for classification.
  var bands = ee.List(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'QA'])
  var bandtypes = ee.List(['int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'uint32'])
  
  // Load S-3 images
  var images = ee.ImageCollection("COPERNICUS/S3/OLCI")
    .filter(ee.Filter.inList("system:index", id_list))
    .map(s3Tools.unboundedCheck)
    .filterMetadata('unbounded', 'not_equals', true)
    .map(function(image){return image.rename(bands).cast(ee.Dictionary.fromLists(bands, bandtypes))})
  print('Training data generator:', images)
  
  images = images
    .map(s3Tools.findMOD11)
    .map(s3Tools.cloudMaskwMOD11v4)
    .map(genTools.addEra5DailyAggregate)
    .map(s3Tools.addOptTemporalDevStatsS3)
    .sort('system:time_start')
  
  var extractTrData = function(image){
    var samplesPerPolygon = 200
    var im_id = image.get('system:index')
    var polygons = tr_polygons.filter(ee.Filter.eq('id', im_id))
    var getPolygonSamples = function(polygon){
      var poly_class = polygon.get('class')
      var poly_id = polygon.get('lakeID')
      var im_tr = image.sample({
        region: polygon.geometry(),
        numPixels: samplesPerPolygon,
        //scale: 20,
        tileScale: 5,
        geometries: true
      })
      im_tr = im_tr.map(function(feature){
      return(feature.set({'class': poly_class, 'lakeID': poly_id}))
      })
    return(im_tr)
    }
    var samples = polygons.map(getPolygonSamples).flatten()
    return(samples)
  }
  
  // Extract training pixels from S-3 images
  var tr_data = images.map(extractTrData).flatten()
  return(tr_data)
}