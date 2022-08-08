exports.getTrainingPixels = function(filename){
  // Load training data
  var tr_polygons = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/training_sets/'+filename)
  //print('Training Set:', tr_polygons)
   
  var l7Tools = require('users/michaelbrechbuehler/msc_thesis:L7 Toolbox')
  var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')
   
  // Get list of scenes used for training
  var id_list = tr_polygons.aggregate_array('id').distinct()
  //print('ID List:', id_list)
  
  // Use these bands for classification.
  var bands = ee.List(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'ST_B6', 'SR_B7'])
  
  // Load L7 images
  var images = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
    .filter(ee.Filter.inList("system:index", id_list))
    .map(l7Tools.maskL7sr) //Filter for clouds with bitmask
    .select(bands)
    .map(genTools.addEra5DailyAggregate)
    .map(l7Tools.addIndicesL7)
    .map(l7Tools.addOptTexturesL7)
    .map(l7Tools.addOptTemporalDevStatsL7)

  // new Function to extract training pixels from image using .sample
  // that only samples numPixels
  var extractTrData = function(image){
    var samplesPerPolygon = 200
    var im_id = image.get('system:index')
    var polygons = tr_polygons.filter(ee.Filter.eq('id', im_id))
    var getPolygonSamples = function(polygon){
      var poly_class = polygon.get('class')
      var poly_id = polygon.get('lakeID')
      var im_tr = image.sample({
        region: polygon.geometry(),
        numPixels: null,
        scale: 30,
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
  
  // Extract training pixels from L7 images
  var tr_data = images.map(extractTrData).flatten()
  return(tr_data)
}