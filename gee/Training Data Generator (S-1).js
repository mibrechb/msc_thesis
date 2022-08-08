exports.getTrainingPixels = function(filename){
  // Load training data
  var tr_polygons = ee.FeatureCollection('users/michaelbrechbuehler/msc_thesis/training_sets/'+filename)
  //print('Training Set:', tr_polygons)
  
    // Load S-1 Toolbox and General Toolbox
  var s1Tools = require('users/michaelbrechbuehler/msc_thesis:S-1 Toolbox')
  var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')
  
  // Get list of scenes used for training
  var id_list = tr_polygons.aggregate_array('id').distinct()
  
  // Use these bands from S-1 collection
  var bands = ee.List(['VV', 'VH', 'angle'])
  
  // Load S-1 images
  var images = ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
    .filter(ee.Filter.inList("system:index", id_list))
    // Filter to get images with VV and VH dual polarization.
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filterMetadata('platform_number', 'equals', 'A')
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    //.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
    .map(s1Tools.addLayoverShadowMask) // add shadow and layover mask based on ALOS DSM
    .map(s1Tools.f_mask_edges) // additional border noise removal
    //.map(s1Tools.slope_correction) // Slope-correction (not necessary for flat lakes)
    .select(bands)
    .map(s1Tools.refinedLee)
    .map(s1Tools.lin_to_db) // backscatter bands in dB for GLCM Textures (see Lohse et. al 2021)
    .map(s1Tools.addOptTexturesS1)
    .map(genTools.scaleTo20m)
    .map(s1Tools.addTemporalDevStats)
    .map(s1Tools.addTemporalDevStatsScale60)
    .map(s1Tools.addWeeklyStats)
    .map(s1Tools.addWeeklyStats60)
    .map(s1Tools.addVVVHRatioDB)
    .map(genTools.addEra5DailyAggregate) // add ERA5 2m temperature band
    //.map(s1Tools.addPassDirS1)1
    
    /*
    .map(s1Tools.f_mask_edges) // additional border noise removal
    //.map(s1Tools.slope_correction) // Slope-correction (not necessary for flat lakes)
    .select(bands)
    .map(s1Tools.lin_to_db) // convert backscatter bands back to dB for GLCM Textures (see Lohse et. al 2021)
    .map(s1Tools.addOptTexturesS1)
    .map(s1Tools.db_to_lin) // convert backscatter bands back to lin
    .map(s1Tools.refinedLee) // speckle filtering
    .map(genTools.scaleTo30m)
    .map(s1Tools.lin_to_db) // convert speckle-filtered backscatter back to dB
    .map(s1Tools.addVVVHRatioDB) // add VV-VH ratio bands
    .map(genTools.addEra5DailyAggregate) // add ERA5 2m temperature band
    //.map(s1Tools.addPassDirS1)
    */

    // new Function to extract training pixels from image using .sample
    // that only samples numPixels
  var extractTrData = function(image){
    var samplesPerPolygon = 50
    var im_id = image.get('system:index')
    var polygons = tr_polygons.filter(ee.Filter.eq('id', im_id))
    var getPolygonSamples = function(polygon){
      var poly_class = polygon.get('class')
      var poly_id = polygon.get('lakeID')
      var im_tr = image.sample({
        region: polygon.geometry(),
        numPixels: samplesPerPolygon,
        scale: 20,
        tileScale: 1,
        geometries: true,
        seed: 3
      })
      im_tr = im_tr.map(function(feature){
      return(feature.set({'class': poly_class, 'lakeID': poly_id}))
      })
    return(im_tr)
    }
    var samples = polygons.map(getPolygonSamples).flatten()
    return(samples)
  }
  
  // Function to rename sample features to get short featurenames (spacesaving)
  var renameProperties = function(feature){
    // Use these bands from S-1
    var bands = ee.List(['VV', 'VH', 'angle']);
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
    // Use these bands for classification
    var bands_ext = bands.cat(ratio).cat(textures).cat(temporalDev).cat(temporalDev60).cat(temporalWeekly).cat(temporalWeekly60).cat(era5).cat(info);
    var bands_rename = [
      'B1', 'B2', 'B3', 
      'R1',
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
      'VVw_p10', 'VHw_p10', 'VVw_p30', 'VVw_p50', 'VVw_p70', 'VVw_p90', 'VHw_p90', 
      'VVtw_p10', 'VHtw_p10', 'VVtw_p30', 'VHtw_p30', 'VVtw_p50', 'VHtw_p50', 'VVtw_p70', 'VHtw_p70', 'VVtw_p90', 'VHtw_p90',
      'VVw60_p10', 'VHw60_p10', 'VVw60_p30', 'VVw60_p50', 'VVw60_p70', 'VVw60_p90', 'VHw60_p90', 
      'VVtw60_p10', 'VHtw60_p10', 'VVtw60_p30', 'VHtw60_p30', 'VVtw60_p50', 'VHtw60_p50', 'VVtw60_p70', 'VHtw60_p70', 'VVtw60_p90', 'VHtw60_p90', 
      'VV_w_median', 'VH_w_median', 'VV_w_mean', 'VH_w_mean', 'VV_w_max', 'VH_w_max', 'VV_w_min', 'VH_w_min',
      'VV60_w_median', 'VH60_w_median', 'VV60_w_mean', 'VH60_w_mean', 'VV60_w_max', 'VH60_w_max', 'VV60_w_min', 'VH60_w_min',
      'ERA', 
      'class', 'lakeID']
    return(feature.select(bands_ext, bands_rename))
  }
  
  // Mapping extraction function over S-1 images and return
  var tr_data = images.map(extractTrData).flatten()
  return(tr_data.map(renameProperties))
}