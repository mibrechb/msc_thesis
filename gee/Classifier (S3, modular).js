// Load S3 Toolbox and General Toolbox
var s3Tools = require('users/michaelbrechbuehler/msc_thesis:S-3 Toolbox')
var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')

// Use these band names instead of long original names
var bands = ee.List(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'QA'])
var temporal = ee.List(['B2tw_p10', 'B21tw_p10', 'B2tw_p30', 'B21tw_p30', 'B2tw_p50', 'B21tw_p50', 'B2tw_p70', 'B21tw_p70', 'B2tw_p90', 'B21tw_p90']);
// Use these bands for classification
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.remove('QA').cat(temporal).cat(era5)
  
exports.ClassifierS3 = function() {
  /*
  // Load Classifier
  var trees = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/classifiers/S3opt_noL_mLP20_balanced_noERA').aggregate_array('tree')//.aside(print)
  var classifier = ee.Classifier.decisionTreeEnsemble(trees)
  */
  
  var trainingset = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/S3opt_TrPix_noL_balanced");
  
  // Filter small lakes <3.2km^2 from trainingpixels (mislocation error)
  trainingset = trainingset.filter(ee.Filter.or(ee.Filter.eq('lakeID',4), ee.Filter.eq('lakeID',5), ee.Filter.eq('lakeID',6), ee.Filter.eq('lakeID',9)))

  // Create a classifier with custom parameters.
  var classifier = ee.Classifier.smileGradientTreeBoost({
    numberOfTrees: 200, 
    shrinkage: 0.1, 
    samplingRate: 0.7, 
    maxNodes: 200, 
    loss: "LeastAbsoluteDeviation" , 
    seed:0
  })
  
  // Train the classifier.
  classifier = classifier.train(trainingset, 'class', bands_ext);
  //print('Classifier:', classifier)
  
  return(classifier)
}


exports.ClassifyS3 = function(classifier, lakemasks, start, end) {
  // Get S-3 Image Collection.
  var images = ee.ImageCollection("COPERNICUS/S3/OLCI")
    .filterBounds(lakemasks.first().geometry())
    .filterDate(start, end)
    .map(s3Tools.unboundedCheck)
    .filterMetadata('unbounded', 'not_equals', true)
    .map(function(im){
      /* Clips image to yearly lakemask */
      var date = im.date()
      var year = ee.Number(date.get('year')).int()
      var lake = lakemasks.filterMetadata('year', 'equals', year).first().geometry()
      im = im.clip(lake);
      im = im.set('lakemask', lake)
      return(im);
    })
    //.filterMetadata('spacecraft', 'equals', 'S3A')
    //.filter(ee.Filter.calendarRange(8, 13, 'hour'))
    .map(s3Tools.findMOD11)
    .filter(ee.Filter.neq('dt_minutes', 0))
    .filter(ee.Filter.lte('dt_minutes_abs', 90))
    .map(s3Tools.cloudMaskwMOD11v4)
    .map(function(image){return image.rename(bands)})
    .map(genTools.addEra5DailyAggregate)
    .map(genTools.addLakeCoverageRatiov2)
    .filterMetadata('coverage', 'greater_than', 0.3)
    .map(s3Tools.addOptTemporalDevStatsS3)
    .select(bands_ext)
    .sort('system:time_start')

  //print('Usable images:', images)
  
  // Classify the imagecollection and keep 'system:time_start' property for plot
  function classification(image){
    var time = image.get('system:time_start')
    var coverage = image.get('coverage')
    return image.classify(classifier).set('system:time_start', time).set('coverage', coverage);
  }
  
  var results = images.map(classification);
  results = s3Tools.exportCoverage(results)
  // Print the resulting classified imagecollection.
  //print('Result (ImageCollection):', results);
  
  return(results)
}