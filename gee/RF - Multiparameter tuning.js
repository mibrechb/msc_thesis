// S1 settings
var sensor = 's1'
var bands_ext= [
    'B1', 'B2', 'B3',
    'R1',
    'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
    'VVw_p10', 'VHw_p10', 'VVw_p30', 'VVw_p50', 'VVw_p70', 'VVw_p90', 'VHw_p90', 
    'VVtw_p10', 'VHtw_p10', 'VVtw_p30', 'VHtw_p30', 'VVtw_p50', 'VHtw_p50', 'VVtw_p70', 'VHtw_p70', 'VVtw_p90', 'VHtw_p90',
    'VVw60_p10', 'VHw60_p10', 'VVw60_p30', 'VVw60_p50', 'VVw60_p70', 'VVw60_p90', 'VHw60_p90', 
    'VVtw60_p10', 'VHtw60_p10', 'VVtw60_p30', 'VHtw60_p30', 'VVtw60_p50', 'VHtw60_p50', 'VVtw60_p70', 'VHtw60_p70', 'VVtw60_p90', 'VHtw60_p90', 
    'VV_w_median', 'VH_w_median', 'VV_w_mean', 'VH_w_mean', 'VV_w_max', 'VH_w_max', 'VV_w_min', 'VH_w_min',
    'VV60_w_median', 'VH60_w_median', 'VV60_w_mean', 'VH60_w_mean', 'VV60_w_max', 'VH60_w_max', 'VV60_w_min', 'VH60_w_min',
    'ERA']
var training = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S1opt_TrPix_L50_balanced_wLayoverShadowMask")
var validation = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S1opt_TrPix_L50_unbalanced_wLayoverShadowMask")


/*
// S2 settings
var sensor = 's2'
var bands = ee.List(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9', 'B11', 'B12']);
var indices = ee.List(['NDWI', 'mNDWI', 'NDSI', 'NDVI', 'BSI', 'FSC'])
var textures = ee.List(['B2_savg_3x3', 'B2_savg_5x5', 'B2_savg_7x7', 'B2_dent_7x7', 'B2_diss_7x7', 'B2_shade_7x7', 'B1_savg_3x3', 'B1_savg_5x5', 'B1_savg_7x7', 'B1_shade_7x7'])
var temporal = ee.List(['B1tw_p10', 'B2tw_p10', 'B1tw_p30', 'B2tw_p30', 'B1tw_p50', 'B2tw_p50', 'B1tw_p70', 'B2tw_p70', 'B1tw_p90', 'B2tw_p90']);
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.cat(textures).cat(indices).cat(temporal).cat(era5);
var training = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S2opt_TrPix_noL_balanced_wWhiting_wTemporal")
var validation = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S2opt_TrPix_noL_unbalanced_wWhiting_wtemporal")
*/

/*
// S3 settings
var sensor = 's3'
// Use these band names instead of long original names
var bands = ee.List(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'QA'])
// Use these bands for classification
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.remove('QA').cat(era5)
var training = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S3opt_TrPix_L200_balanced_wTemporal")
var validation = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/S3opt_TrPix_L200_unbalanced_wTemporal")
*/

/*
// L7 settings
var sensor = 'l7'
var bands = ee.List(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'ST_B6', 'SR_B7']);
var indices = ee.List(['NDWI', 'mNDWI', 'NDSI', 'NDVI', 'BSI'])
var textures = ee.List(['NDSI_savg_3x3', 'NDSI_savg_5x5', 'NDSI_dvar_5x5', 'NDSI_savg_7x7', 'NDSI_contrast_7x7', 'ST_B6_savg_3x3', 'ST_B6_savg_5x5', 'ST_B6_savg_7x7', 'ST_B6_imcorr2_7x7', 'ST_B6_ENTR_7x7'])
var temporal = ee.List(['NDSItw_p10', 'ST_B6tw_p10', 'NDSItw_p30', 'ST_B6tw_p30', 'NDSItw_p50', 'ST_B6tw_p50', 'NDSItw_p70', 'ST_B6tw_p70', 'NDSItw_p90', 'ST_B6tw_p90']);
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.cat(indices).cat(temporal).cat(era5).cat(textures);
var training = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/L7opt_TrPix_L200_balanced_wTemporal")
var validation = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/L7opt_TrPix_L200_unbalanced_wTemporal")
*/

/*
// L8 settings
var sensor = 'l8'
var bands = ee.List(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10']);
var indices = ee.List(['NDWI', 'mNDWI', 'NDSI', 'NDVI', 'BSI'])
var textures = ee.List(['SR_B1_savg_3x3','SR_B1_savg_5x5', 'SR_B1_diss_5x5','SR_B1_savg_7x7', 'SR_B1_diss_7x7', 'SR_B1_inertia_7x7', 'SR_B1_contrast_7x7', 'ST_B10_savg_3x3', 'ST_B10_savg_5x5', 'ST_B10_savg_7x7'])
var temporal = ee.List(['SR_B1tw_p10', 'ST_B10tw_p10', 'SR_B1tw_p30', 'ST_B10tw_p30', 'SR_B1tw_p50', 'ST_B10tw_p50', 'SR_B1tw_p70', 'ST_B10tw_p70', 'SR_B1tw_p90', 'ST_B10tw_p90']);
var era5 = ee.List(['ERA5_t2m'])
var bands_ext = bands.cat(era5).cat(temporal).cat(indices).cat(textures);
var training = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/L8opt_TrPix_L200_balanced_wTemporal")
var validation = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/training_pixels/final/L8opt_TrPix_L200_unbalanced_wTemporal")
*/

// Set parameter combinations
var var_mlp_sz = 20
var var_mlp_step = 2

var var_vps_sz = 64
var var_vps_step = 2

var combinations = []

for (var lolo = 1; lolo<=9; lolo+=1) {
      for (var vps = 1; vps<=var_vps_sz; vps=vps+var_vps_step) {
            for (var mlp = 1; mlp<=var_mlp_sz; mlp=mlp+var_mlp_step) {
              combinations.push([lolo, vps, mlp])
            }
      }
}

print('Parameter combinations: ', combinations)

// Setup classification function
var classification = function(params){
  // Get the parameter settings from input
  var params_list = ee.List(params)
  var lolo = ee.Number(params_list.get(0))
  var vps = ee.Number(params_list.get(1))
  var mlp = ee.Number(params_list.get(2))

  // Prepare training and validation set
  // Load training and validation data
  //var training = training_set.filterMetadata('random', 'less_than', 0.75)
  var temp_training = training.filter(ee.Filter.neq('lakeID', lolo))
  //print('Training lakes:', training.aggregate_array('lakeID').distinct())
  //print('Training example:', training.first())
  //print('Trainingset size:', training.size())
  
  //var validation = training_set.filterMetadata('random', 'greater_than', 0.75)
  var temp_validation = validation.filter(ee.Filter.eq('lakeID', lolo))
  //print('Validation lakes:', validation.aggregate_array('lakeID').distinct())
  //print('Validationset size:', validation.size())

  // Make a Random Forest classifier and train it.
  var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees: 200,
    variablesPerSplit: vps,
    minLeafPopulation: mlp,
    bagFraction: 0.5,
    //maxNodes: mn
  })
  
  .train({
    features: temp_training,
    classProperty: 'class',
    inputProperties: bands_ext
  });
  
  //print('Classifier:', tune, classifier.explain())
  
  // Get a confusion matrix representing resubstitution accuracy.
  var trainAccuracy = classifier.confusionMatrix();
  //print('Resubstitution error matrix: ', trainAccuracy);
  //print('Training overall accuracy: ', trainAccuracy.accuracy());
  
  // Classify the validation data.
  var validated = temp_validation.classify(classifier);
  
  // Get a confusion matrix representing expected accuracy.
  var testAccuracy = validated.errorMatrix('class', 'classification');
  
  var result = ee.Feature(geometry, {
    'mlp': mlp,
    'vps': vps,
    'oa': testAccuracy.accuracy(),
    'ca': testAccuracy.consumersAccuracy(),
    'pa': testAccuracy.producersAccuracy(),
    'lolo': lolo,
    //'error_matrix': testAccuracy,
    'kappa': testAccuracy.kappa()
  })
  return(result)
}

// Run train-classifiy-validate with LOLO-CV
var combinations_list = ee.List(combinations)
var results = ee.FeatureCollection(combinations_list.map(classification))
print(results)
Export.table.toDrive(results, sensor+'_LOLOCV', 'EE_EXPORT')