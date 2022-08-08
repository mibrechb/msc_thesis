// Load S-1 Toolbox and General Toolbox
var s1Tools = require('users/michaelbrechbuehler/msc_thesis:S-1 Toolbox')
var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')

var bands = ee.List(['VV', 'VH', 'angle']);
var bands_noAngle = ee.List(['VV', 'VH']);
var ratio = ee.List(['VVVHratio'])
// Additional bands
var textures = ee.List(['VH_savg_3x3', 'VH_savg_5x5', 'VH_savg_7x7', 'VV_savg_3x3', 'VV_savg_5x5', 'VV_savg_7x7', 'VV_inertia_7x7', 'VV_contrast_7x7', 'VV_diss_7x7', 'VV_var_7x7'])
var temporalTextures = ee.List(['VHtw_savg_3x3', 'VHtw_savg_5x5', 'VHtw_savg_7x7', 'VVtw_savg_3x3', 'VVtw_savg_5x5', 'VVtw_savg_7x7', 'VVtw_inertia_7x7', 'VVtw_contrast_7x7', 'VVtw_diss_7x7', 'VVtw_var_7x7'])
var era5 = ee.List(['ERA5_t2m'])
var info = ee.List(['class', 'lakeID'])
// temporal bands
var w_list = ee.List(['VVw_p10', 'VHw_p10', 'VVw_p30', 'VVw_p50', 'VVw_p70', 'VVw_p90', 'VHw_p90']);
var tw_list = ee.List(['VVtw_p10', 'VHtw_p10', 'VVtw_p30', 'VHtw_p30', 'VVtw_p50', 'VHtw_p50', 'VVtw_p70', 'VHtw_p70', 'VVtw_p90', 'VHtw_p90']);
var temporalDev = w_list.cat(tw_list);
var w60_list = ee.List(['VVw60_p10', 'VHw60_p10', 'VVw60_p30', 'VVw60_p50', 'VVw60_p70', 'VVw60_p90', 'VHw60_p90']);
var tw60_list = ee.List(['VVtw60_p10', 'VHtw60_p10', 'VVtw60_p30', 'VHtw60_p30', 'VVtw60_p50', 'VHtw60_p50', 'VVtw60_p70', 'VHtw60_p70', 'VVtw60_p90', 'VHtw60_p90']);
var temporalDev60 = w60_list.cat(tw60_list);
var temporalWeekly =  ['VV_w_median', 'VH_w_median', 'VV_w_mean', 'VH_w_mean', 'VV_w_max', 'VH_w_max', 'VV_w_min', 'VH_w_min']
var temporalWeekly60 =  ['VV60_w_median', 'VH60_w_median', 'VV60_w_mean', 'VH60_w_mean', 'VV60_w_max', 'VH60_w_max', 'VV60_w_min', 'VH60_w_min']
// Use these bands for classification
var bands_ext = bands.cat(ratio).cat(textures).cat(temporalDev).cat(temporalDev60).cat(temporalWeekly).cat(temporalWeekly60).cat(era5);
var bands_ext_renamed = [
    'B1', 'B2', 'angle',
    'R1',
    'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
    'VVw_p10', 'VHw_p10', 'VVw_p30', 'VVw_p50', 'VVw_p70', 'VVw_p90', 'VHw_p90', 
    'VVtw_p10', 'VHtw_p10', 'VVtw_p30', 'VHtw_p30', 'VVtw_p50', 'VHtw_p50', 'VVtw_p70', 'VHtw_p70', 'VVtw_p90', 'VHtw_p90',
    'VVw60_p10', 'VHw60_p10', 'VVw60_p30', 'VVw60_p50', 'VVw60_p70', 'VVw60_p90', 'VHw60_p90', 
    'VVtw60_p10', 'VHtw60_p10', 'VVtw60_p30', 'VHtw60_p30', 'VVtw60_p50', 'VHtw60_p50', 'VVtw60_p70', 'VHtw60_p70', 'VVtw60_p90', 'VHtw60_p90', 
    'VV_w_median', 'VH_w_median', 'VV_w_mean', 'VH_w_mean', 'VV_w_max', 'VH_w_max', 'VV_w_min', 'VH_w_min',
    'VV60_w_median', 'VH60_w_median', 'VV60_w_mean', 'VH60_w_mean', 'VV60_w_max', 'VH60_w_max', 'VV60_w_min', 'VH60_w_min',
    'ERA']

exports.ClassifierS1 = function() {
  /*
  // Load Classifier
  var trees = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/classifiers/S1opt_T180_mLP2_vPS10_L20_R1_20M').aggregate_array('tree')//.aside(print)
  var classifier = ee.Classifier.decisionTreeEnsemble(trees)
  */
  
  // Import trainingpixels
  //var trainingset = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/S1opt_TrPix_L50_wTemporalStats_wWeekly_balanced");
  var trainingset = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S1opt_TrPix_L50_balanced_wLayoverShadowMask");
  
  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: 500,
    //variablesPerSplit: 20,
    //minLeafPopulation: 20,
    //bagFraction: 0.5,
    //maxNodes: null
  })
  
  /*
  // Create a classifier with custom parameters.
  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: 500,
    variablesPerSplit: 12,
    minLeafPopulation: 1,
    bagFraction: 0.5,
    maxNodes: null
  })
  */
  
  // Train the classifier.
  classifier = classifier.train(trainingset, 'class', bands_ext_renamed);
  //print('Classifier:', classifier)
  
  return(classifier)
}


exports.ClassifyS1 = function(classifier, lakemasks, start, end) {
  // Get S-1 imagecollection
  var images = ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
    .filterBounds(lakemasks.first().geometry())
    .filterDate(start, end)
    // Filter to get images with VV and VH dual polarization.
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    //.filter(ee.Filter.eq('platform_number', 'A'))
    //.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
    .map(function(im){
      /* Clips image to yearly lakemask */
      var date = im.date()
      var year = ee.Number(date.get('year')).int()
      var lake = lakemasks.filterMetadata('year', 'equals', year).first().geometry()
      im = im.clip(lake);
      im = im.set('lakemask', lake)
      return(im);
    })
    .map(s1Tools.f_mask_edges) // additional border noise removal
    .map(s1Tools.addLayoverShadowMask) // add shadow and layover mask based on ALOS DSM
    .map(genTools.addLakeCoverageRatiov2)
    .filterMetadata('coverage', 'greater_than', 0.3)
    //.map(s1Tools.slope_correction) // Slope-correction (not necessary for flat lakes)
    .select(bands)
    .map(s1Tools.refinedLee) // speckle filtering
    .map(s1Tools.lin_to_db) // convert backscatter bands back to dB for GLCM Textures (see Lohse et. al 2021)
    .map(s1Tools.addOptTexturesS1)
    .map(genTools.scaleTo20m)
    .map(s1Tools.addTemporalDevStats)
    .map(s1Tools.addTemporalDevStatsScale60)
    .map(s1Tools.addWeeklyStats)
    .map(s1Tools.addWeeklyStats60)
    .map(s1Tools.addVVVHRatioDB)
    .map(genTools.addEra5DailyAggregate) // add ERA5 2m temperature band
    .select(bands_ext, bands_ext_renamed)
    .sort('system:time_start')

  //print('Images:', images)
  
  // Classify the imagecollection and keep 'system:time_start' property for plot
  function classification(image){
    var time = image.get('system:time_start')
    var coverage = image.get('coverage')
    return image.classify(classifier).set('system:time_start', time).set('coverage', coverage);
  }
  
  var results = images.map(classification);
  
  // Print the resulting classified imagecollection.
  //print('Result (ImageCollection):', result);
  
  return(s1Tools.exportCoverage(results))
}