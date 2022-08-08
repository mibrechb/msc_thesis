// Load S2 Toolbox and General Toolbox
var s2Tools = require('users/michaelbrechbuehler/msc_thesis:S-2 Toolbox')
var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')

// Use these bands from S-2
var bands = ee.List(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9', 'B11', 'B12']);

// Use these bands for classification
var indices = ee.List(['NDWI', 'mNDWI', 'NDSI', 'NDVI', 'BSI', 'FSC'])
var textures = ee.List(['B2_savg_3x3', 'B2_savg_5x5', 'B2_savg_7x7', 'B2_dent_7x7', 'B2_diss_7x7', 'B2_shade_7x7', 'B1_savg_3x3', 'B1_savg_5x5', 'B1_savg_7x7', 'B1_shade_7x7'])
var temporal = ee.List(['B1tw_p10', 'B2tw_p10', 'B1tw_p30', 'B2tw_p30', 'B1tw_p50', 'B2tw_p50', 'B1tw_p70', 'B2tw_p70', 'B1tw_p90', 'B2tw_p90']);
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.cat(textures).cat(indices).cat(temporal).cat(era5);

exports.ClassifierS2 = function() {
  // Load Classifier
  //var trees = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/classifiers/S2opt_noL_mLP20_balanced').aggregate_array('tree')//.aside(print)
  //var classifier = ee.Classifier.decisionTreeEnsemble(trees)
  
  var trainingset = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S2opt_TrPix_noL_balanced_wWhiting_wTemporal");
  
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
    return(classifier)
}

exports.ClassifyS2 = function(classifier, lakemasks, start, end) {
  // Remove original mask to reduce missing pixels
  function unmask(img){
    return(img.unmask())
  }
  
  // Load imagecollection
  var s2Sr = ee.ImageCollection("COPERNICUS/S2_SR").map(unmask)
  
  // Define cloud probability threshold
  var MAX_CLOUD_PROBABILITY = 20;
  
  // *-*-*- Cloud Masking with s2cloudless dataset *-*-*-
  // Cloudmask function
  var s2Clouds = ee.ImageCollection("COPERNICUS/S2_CLOUD_PROBABILITY");
  
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
    .filterBounds(lakemasks.first().geometry())
    .filterDate(start, end)
    .map(function(im){
      var date = im.date();
      var year = ee.Number(date.get('year')).int();
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
    .select(bands)
    .map(genTools.addEra5DailyAggregate)
    .map(genTools.addLakeCoverageRatiov2)
    .filterMetadata('coverage', 'greater_than', 0.3)
    .map(s2Tools.addIndicesS2)
    .map(s2Tools.addOptTexturesS2)
    .map(s2Tools.addOptTemporalDevStatsS2)
    .select(bands_ext)
    .sort('system:time_start')
  
  // Classify the imagecollection.
  function classification(image){
    var time = image.get('system:time_start')
    var coverage = image.get('coverage')
    var classified_image = image.classify(classifier).set('system:time_start', time).set('coverage', coverage)
    return classified_image;
  }
  
  var results = images.map(classification);
  
  // Print the resulting classified imagecollection.
  //print('Result (ImageCollection):', results);
  
  return(s2Tools.exportCoverage(results))
}