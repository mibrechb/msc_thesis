// Load L7 Toolbox and General Toolbox
var l7Tools = require('users/michaelbrechbuehler/msc_thesis:L7 Toolbox')
var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')

// Use these bands from L7
var bands = ee.List(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'ST_B6', 'SR_B7']);

// Use these bands for classification
var indices = ee.List(['NDWI', 'mNDWI', 'NDSI', 'NDVI', 'BSI'])
var textures = ee.List(['NDSI_savg_3x3', 'NDSI_savg_5x5', 'NDSI_dvar_5x5', 'NDSI_savg_7x7', 'NDSI_contrast_7x7', 'ST_B6_savg_3x3', 'ST_B6_savg_5x5', 'ST_B6_savg_7x7', 'ST_B6_imcorr2_7x7', 'ST_B6_ENTR_7x7'])
var temporal = ee.List(['NDSItw_p10', 'ST_B6tw_p10', 'NDSItw_p30', 'ST_B6tw_p30', 'NDSItw_p50', 'ST_B6tw_p50', 'NDSItw_p70', 'ST_B6tw_p70', 'NDSItw_p90', 'ST_B6tw_p90']);
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.cat(indices).cat(temporal).cat(era5).cat(textures);

exports.ClassifierL7 = function(){
  
  // Load Classifier
  //var trees = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/classifiers/L7opt_L200_balanced').aggregate_array('tree')//.aside(print)
  //var classifier = ee.Classifier.decisionTreeEnsemble(trees)
  
  var trainingset = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/L7opt_TrPix_L200_balanced_wTemporal");
  // Create a classifier with custom parameters.
  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: 500,
    //variablesPerSplit: 10,
    //minLeafPopulation: 1,
    //bagFraction: 0.5,
    //maxNodes: null
  })
  
  // Train the classifier.
  classifier = classifier.train(trainingset, 'class', bands_ext);
  //print('Classifier:', classifier)
  
  return(classifier)
}

exports.ClassifyL7 = function(classifier, lakemasks, start, end) {
  // Get L7 ImageCollection
  var images = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
    .filterBounds(lakemasks.first().geometry())
    .filterDate(start, end)
    .map(function(im){
      var date = im.date()
      var year = ee.Number(date.get('year')).int()
      var lake = lakemasks.filterMetadata('year', 'equals', year).first().geometry()
      var intersection_test = im.geometry().intersects(lake, 1)
      return(im.set('intersects', intersection_test))
    })
    .filterMetadata('intersects', 'equals', true)
    .map(function(im){
      /* Clips image to yearly lakemask */
      var date = im.date()
      var year = ee.Number(date.get('year')).int()
      var lake = lakemasks.filterMetadata('year', 'equals', year).first().geometry()
      im = im.clip(lake);
      im = im.set('lakemask', lake)
      return(im);
    })
    .map(l7Tools.maskL7sr) //Filter for clouds with bitmask
    .select(bands)
    .map(genTools.addEra5DailyAggregate)
    .map(genTools.addLakeCoverageRatiov2)
    .filterMetadata('coverage', 'greater_than', 0.3)
    .map(l7Tools.addIndicesL7)
    .map(l7Tools.addOptTexturesL7)
    .map(l7Tools.addOptTemporalDevStatsL7)
    .select(bands_ext)
    .sort('system:time_start')
  
  // Classify the imagecollection.
  function classification(image){
    var time = image.get('system:time_start')
    var coverage = image.get('coverage')
    return image.select(bands_ext).classify(classifier).set('system:time_start', time).set('coverage', coverage);
  }
  
  var results = images.map(classification);
  
  // Print the resulting classified imagecollection.
  //print('Result (ImageCollection):', results);
  
  return(l7Tools.exportCoverage(results))
}