// Load L8 Toolbox and General Toolbox
var l8Tools = require('users/michaelbrechbuehler/msc_thesis:L8 Toolbox')
var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')

// Use these bands from L8
var bands = ee.List(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10']);

// Use these bands for classification
var indices = ee.List(['NDWI', 'mNDWI', 'NDSI', 'NDVI', 'BSI'])
var textures = ee.List(['SR_B1_savg_3x3','SR_B1_savg_5x5', 'SR_B1_diss_5x5','SR_B1_savg_7x7', 'SR_B1_diss_7x7', 'SR_B1_inertia_7x7', 'SR_B1_contrast_7x7', 'ST_B10_savg_3x3', 'ST_B10_savg_5x5', 'ST_B10_savg_7x7'])
var temporal = ee.List(['SR_B1tw_p10', 'ST_B10tw_p10', 'SR_B1tw_p30', 'ST_B10tw_p30', 'SR_B1tw_p50', 'ST_B10tw_p50', 'SR_B1tw_p70', 'ST_B10tw_p70', 'SR_B1tw_p90', 'ST_B10tw_p90']);
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.cat(era5).cat(temporal).cat(indices).cat(textures);

exports.ClassifierL8 = function() {

  // Load Classifier
  //var trees = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/classifiers/L8opt_L200_balanced').aggregate_array('tree')//.aside(print)
  //var classifier = ee.Classifier.decisionTreeEnsemble(trees)
  
  var trainingset = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/L8opt_TrPix_L200_balanced_wTemporal");
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

exports.ClassifyL8 = function(classifier, lakemasks, start, end) {
  // Get L8 ImageCollection
  var images = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
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
    .map(l8Tools.maskL8sr) //Filter for clouds with bitmask
    .select(bands)
    .map(genTools.addEra5DailyAggregate)
    .map(genTools.addLakeCoverageRatiov2)
    .filterMetadata('coverage', 'greater_than', 0.3)
    .map(l8Tools.addIndicesL8)
    .map(l8Tools.addOptTexturesL8)
    .map(l8Tools.addOptTemporalDevStatsL8)
    .select(bands_ext)
    .sort('system:time_start')
    
  //print('Usable images:', images)
  
  // Classify the imagecollection.
  function classification(image){
    var time = image.get('system:time_start')
    var coverage = image.get('coverage')
    return image.select(bands_ext).classify(classifier).set('system:time_start', time).set('coverage', coverage);
  }
  
  var results = images.map(classification);
    
  // Print the resulting classified imagecollection.
  //print('Result (ImageCollection):', results);
  
  return(l8Tools.exportCoverage(results))
}