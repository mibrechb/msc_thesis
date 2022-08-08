exports.getTrainingPixels = function(filename){
  // Load training data
  var tr_polygons = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/training_sets/'+filename)
  //print('Training Set:', tr_polygons)

  // Load S2 Toolbox and General Toolbox
  var s2Tools = require('users/michaelbrechbuehler/msc_thesis:S-2 Toolbox')
  var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')

  // Get list of scenes used for training
  var id_list = tr_polygons.aggregate_array('id').distinct()
  //print('ID List:', id_list)
  
  // Use these bands for classification.
  var bands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9', 'B11', 'B12'];

  // Load S-2 images
  var images = ee.ImageCollection("COPERNICUS/S2_SR")
    .filter(ee.Filter.inList("system:index", id_list))
    .select(bands)
    .map(genTools.addEra5DailyAggregate)
    .map(s2Tools.addIndicesS2)
    .map(s2Tools.addOptTexturesS2)
    .map(s2Tools.addOptTemporalDevStatsS2)
    
  var extractTrData = function(image){
    var samplesPerPolygon = 200
    var im_id = image.get('system:index')
    var polygons = tr_polygons.filter(ee.Filter.eq('id', im_id))
    var getPolygonSamples = function(polygon){
      var poly_class = polygon.get('class')
      var poly_id = polygon.get('lakeID')
      var im_tr = image.sample({
        region: polygon.geometry(),
        //numPixels: samplesPerPolygon,
        //scale: 20,
        tileScale: 1,
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
  
  // Extract training pixels from S-2 images
  var tr_data = images.map(extractTrData).flatten()
  return(tr_data)
}