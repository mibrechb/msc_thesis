exports.addOptTexturesS2 = function(image){
  // Add GLCM and entropy textures for 2 most important bands (defined by mean over normalized Gini-impurity and accuracy decrease)
  var image_int32 = image.select(['B1', 'B2'])/*.multiply(ee.Image([1000, 1000]))*/.cast({B1:'int32', B2:'int32'})
  // define kernels with pixel sizes of 3x3, 5x5, 7x7 (Note: kernels are defined in radii!)
  var sq3 = ee.Kernel.square({radius: 1});
  var sq5 = ee.Kernel.square({radius: 2});
  var sq7 = ee.Kernel.square({radius: 3});
  // add Entropy for B1 band with window sizes: 3, 5 and 7
  var ent3_B1 = image_int32.select('B1').entropy(sq3).rename('B1_ENTR_3x3')
  var ent5_B1 = image_int32.select('B1').entropy(sq5).rename('B1_ENTR_5x5')
  var ent7_B1 = image_int32.select('B1').entropy(sq7).rename('B1_ENTR_7x7')
  //image = image.addBands(ent3_B1);
  //image = image.addBands(ent5_B1);
  //image = image.addBands(ent7_B1);
  // add Entropy for B2 band with window sizes: 3, 5 and 7
  var ent3_B2 = image_int32.select('B2').entropy(sq3).rename('B2_ENTR_3x3')
  var ent5_B2 = image_int32.select('B2').entropy(sq5).rename('B2_ENTR_5x5')
  var ent7_B2 = image_int32.select('B2').entropy(sq7).rename('B2_ENTR_7x7')
  //image = image.addBands(ent3_B2);
  //image = image.addBands(ent5_B2);
  //image = image.addBands(ent7_B2);
  // add GLCM for B2 with window sizes: 3, 5 and 7
  var glcm3_B2 = image_int32.select('B2').glcmTexture({size: 1}).rename(['B2_asm_3x3', 'B2_contrast_3x3', 'B2_corr_3x3', 'B2_var_3x3', 'B2_idm_3x3', 'B2_savg_3x3', 'B2_svar_3x3', 'B2_sent_3x3', 'B2_ent_3x3', 'B2_dvar_3x3', 'B2_dent_3x3', 'B2_imcorr1_3x3', 'B2_imcorr2_3x3', 'B2_maxcorr_3x3', 'B2_diss_3x3', 'B2_inertia_3x3', 'B2_shade_3x3', 'B2_prom_3x3']);
  var glcm5_B2 = image_int32.select('B2').glcmTexture({size: 2}).rename(['B2_asm_5x5', 'B2_contrast_5x5', 'B2_corr_5x5', 'B2_var_5x5', 'B2_idm_5x5', 'B2_savg_5x5', 'B2_svar_5x5', 'B2_sent_5x5', 'B2_ent_5x5', 'B2_dvar_5x5', 'B2_dent_5x5', 'B2_imcorr1_5x5', 'B2_imcorr2_5x5', 'B2_maxcorr_5x5', 'B2_diss_5x5', 'B2_inertia_5x5', 'B2_shade_5x5', 'B2_prom_5x5']);
  var glcm7_B2 = image_int32.select('B2').glcmTexture({size: 3}).rename(['B2_asm_7x7', 'B2_contrast_7x7', 'B2_corr_7x7', 'B2_var_7x7', 'B2_idm_7x7', 'B2_savg_7x7', 'B2_svar_7x7', 'B2_sent_7x7', 'B2_ent_7x7', 'B2_dvar_7x7', 'B2_dent_7x7', 'B2_imcorr1_7x7', 'B2_imcorr2_7x7', 'B2_maxcorr_7x7', 'B2_diss_7x7', 'B2_inertia_7x7', 'B2_shade_7x7', 'B2_prom_7x7']);
  image = image.addBands(glcm3_B2.select(['B2_savg_3x3']));
  image = image.addBands(glcm5_B2.select(['B2_savg_5x5']));
  image = image.addBands(glcm7_B2.select(['B2_savg_7x7', 'B2_dent_7x7', 'B2_diss_7x7', 'B2_shade_7x7']));
  // add GLCM for B1 with window sizes: 3, 5 and 7
  var glcm3_B1 = image_int32.select('B1').glcmTexture({size: 1}).rename(['B1_asm_3x3', 'B1_contrast_3x3', 'B1_corr_3x3', 'B1_var_3x3', 'B1_idm_3x3', 'B1_savg_3x3', 'B1_svar_3x3', 'B1_sent_3x3', 'B1_ent_3x3', 'B1_dvar_3x3', 'B1_dent_3x3', 'B1_imcorr1_3x3', 'B1_imcorr2_3x3', 'B1_maxcorr_3x3', 'B1_diss_3x3', 'B1_inertia_3x3', 'B1_shade_3x3', 'B1_prom_3x3']);
  var glcm5_B1 = image_int32.select('B1').glcmTexture({size: 2}).rename(['B1_asm_5x5', 'B1_contrast_5x5', 'B1_corr_5x5', 'B1_var_5x5', 'B1_idm_5x5', 'B1_savg_5x5', 'B1_svar_5x5', 'B1_sent_5x5', 'B1_ent_5x5', 'B1_dvar_5x5', 'B1_dent_5x5', 'B1_imcorr1_5x5', 'B1_imcorr2_5x5', 'B1_maxcorr_5x5', 'B1_diss_5x5', 'B1_inertia_5x5', 'B1_shade_5x5', 'B1_prom_5x5']);
  var glcm7_B1 = image_int32.select('B1').glcmTexture({size: 3}).rename(['B1_asm_7x7', 'B1_contrast_7x7', 'B1_corr_7x7', 'B1_var_7x7', 'B1_idm_7x7', 'B1_savg_7x7', 'B1_svar_7x7', 'B1_sent_7x7', 'B1_ent_7x7', 'B1_dvar_7x7', 'B1_dent_7x7', 'B1_imcorr1_7x7', 'B1_imcorr2_7x7', 'B1_maxcorr_7x7', 'B1_diss_7x7', 'B1_inertia_7x7', 'B1_shade_7x7', 'B1_prom_7x7']);
  image = image.addBands(glcm3_B1.select(['B1_savg_3x3']));
  image = image.addBands(glcm5_B1.select(['B1_savg_5x5']));
  image = image.addBands(glcm7_B1.select(['B1_savg_7x7', 'B1_shade_7x7']));
  return(image)
}

exports.addOptTemporalDevStatsS2 = function(image){
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

  // Yearly coll
  var date = ee.Date(image.get('system:time_start'));
  var start = date.advance(-182.5, 'day');
  var end =  date.advance(182.5, 'day');
  var yearlyColl = images
    .filterDate(start, end)
  // reduce yearly imagecollection to n-th percentile image
  var p = [10, 30, 50, 70, 90];
  var B1perc = yearlyColl.select('B1').reduce(ee.Reducer.percentile(p));
  var B2perc = yearlyColl.select('B2').reduce(ee.Reducer.percentile(p));
   
  // Find deviation from two-weekly to yearly
  start = date.advance(-7, 'day');
  end =  date.advance(7, 'day');
  var twoWeeklyColl = images
    .filterDate(start, end)

  var B1twmean = twoWeeklyColl.select('B1').reduce(ee.Reducer.mean()).select('B1_mean');
  var B2twmean = twoWeeklyColl.select('B2').reduce(ee.Reducer.mean()).select('B2_mean');
  var B1tw_p10 = B1twmean.subtract(B1perc.select('B1_p10')).rename('B1tw_p10');
  var B2tw_p10 = B2twmean.subtract(B2perc.select('B2_p10')).rename('B2tw_p10');
  var B1tw_p30 = B1twmean.subtract(B1perc.select('B1_p30')).rename('B1tw_p30');
  var B2tw_p30 = B2twmean.subtract(B2perc.select('B2_p30')).rename('B2tw_p30');
  var B1tw_p50 = B1twmean.subtract(B1perc.select('B1_p50')).rename('B1tw_p50');
  var B2tw_p50 = B2twmean.subtract(B2perc.select('B2_p50')).rename('B2tw_p50');
  var B1tw_p70 = B1twmean.subtract(B1perc.select('B1_p70')).rename('B1tw_p70');
  var B2tw_p70 = B2twmean.subtract(B2perc.select('B2_p70')).rename('B2tw_p70');
  var B1tw_p90 = B1twmean.subtract(B1perc.select('B1_p90')).rename('B1tw_p90');
  var B2tw_p90 = B2twmean.subtract(B2perc.select('B2_p90')).rename('B2tw_p90');
  var list = [B1tw_p10, B2tw_p10, B1tw_p30, B2tw_p30, B1tw_p50, B2tw_p50, B1tw_p70, B2tw_p70, B1tw_p90, B2tw_p90];
  return(image.addBands(list));
};

exports.rescale60 = function(img) {
  var crs = img.select(0).projection().crs()
  return(img.reproject({crs: crs, scale: 60}))
}

exports.addIndicesS2 = function(img) {
  // Define bands
  var red = img.select('B4');
  var green = img.select('B3')
  var blue = img.select('B2');
  var nir = img.select('B8');
  var swir = img.select('B11');
  var mir = img.select('B12')
  // Indices (normalizedDifference() not used since values are capped to [-1, -1])
  var BSI = ((swir.add(red)).subtract(nir.add(blue))).divide((swir.add(red)).add(nir.add(blue))).rename('BSI').multiply(10000).toInt16();
  var NDWI = green.subtract(nir).divide(green.add(nir)).rename('NDWI').multiply(10000).toInt16();
  var mNDWI = green.subtract(mir).divide(green.add(mir)).rename('mNDWI').multiply(10000).toInt16();
  var NDSI_unscaled = green.subtract(swir).divide(green.add(swir)).rename('NDSI')
  var NDSI = NDSI_unscaled.multiply(10000).toInt16(); // Same as mNDWI
  var NDVI = nir.subtract(red).divide(nir.add(red)).rename('NDVI').multiply(10000).toInt16();
  // Fractional Snow Cover from NDSI 
  // FSC can be represented with a sigmoid-shaped function 0.5 × tanh(a × NDSI + b) + 0.5, where a = 2.65 and b = −1.42
  // Estimating Fractional Snow Cover in Open Terrain from Sentinel-2 Using the Normalized Difference Snow Index
  // Remote Sens. 2020, 12(18), 2904; https://doi.org/10.3390/rs12182904
  var a = 2.65
  var b = -1.42
  var FSC = (NDSI_unscaled.multiply(a).add(b)).tanh().multiply(0.5).add(0.5).rename('FSC').multiply(10000).toInt16()
  // Add bands to image
  img = img.addBands([NDWI, mNDWI, NDSI, NDVI, BSI, FSC]);
  return(img);
}

exports.plotCoverage = function(featurecollection){
  // get proportion of covered lake and add it to images as property
  // classes: {0:empty, 1:snow, 2:ice, 3:water, 4:shd on snow, 5:shd on ice, 6:thin ice, 7:vegetation, 8:soil}
  var result_wratio = featurecollection.map(function(feature) {
    var snow =        feature.eq(1).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var ice =         feature.eq(2).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var water =       feature.eq(3).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var shd_snow =    feature.eq(4).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var shd_ice =     feature.eq(5).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var thin_ice =    feature.eq(6).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var vegetation =  feature.eq(7).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var soil =        feature.eq(8).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    // save counts as numbers
    var n_ice =         ee.Number.parse(ice)
    var n_snow =        ee.Number.parse(snow)
    var n_water =       ee.Number.parse(water)
    var n_shd_snow =    ee.Number.parse(shd_snow)
    var n_shd_ice =     ee.Number.parse(shd_ice)
    var n_thin_ice =    ee.Number.parse(thin_ice)
    var n_vegetation =  ee.Number.parse(vegetation)
    var n_soil =        ee.Number.parse(soil)
    // add up numbers
    var n_covered = n_ice.add(n_snow).add(n_shd_snow).add(n_shd_ice).add(n_thin_ice)
    var n_total = n_covered.add(n_water)
    var n_prop = (n_covered).divide(n_total).multiply(100)
    // Set numbers as new image properties.
    feature = feature.set('proportion',n_prop).set('proportion',n_prop);
    return(feature)
  });
  // Get properties as lists.
  var list_prop = result_wratio.aggregate_array('proportion')
  var list_time = featurecollection.aggregate_array('system:time_start')
  // Define and plot the proportion of covered lake area over time.
  var scatterplot = ui.Chart.array
    .values({array: list_prop, axis: 0, xLabels: list_time})
    .setOptions({
      title: 'Proportion of covered Lake Area over Time',
      colors: ['cf513e'],
      hAxis: {
        title: 'Date',
        titleTextStyle: {italic: false, bold: true},
      },
      vAxis: {
        title: 'Lake coverage [%]',
        titleTextStyle: {italic: false, bold: true},
        minValue: 0,
        maxValue: 100
      },
      pointSize: 4,
      lineSize: 2,
      //dataOpacity: 0.4,
      legend: {position: 'none'},
      //curveType: 'function'
  });
  print(scatterplot);
}

exports.plotCoverageClasses = function(featurecollection){
  // get proportion of covered lake and add it to images as property
  // classes: {0:empty, 1:snow, 2:ice, 3:water, 4:shd on snow, 5:shd on ice, 6:thin ice, 7:vegetation, 8:soil}
  var result_wratio = featurecollection.map(function(feature) {
    var reduced = feature.reduceRegion(ee.Reducer.countDistinctNonNull())
    var snow =        feature.eq(1).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var ice =         feature.eq(2).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var water =       feature.eq(3).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var shd_snow =    feature.eq(4).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var shd_ice =     feature.eq(5).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var thin_ice =    feature.eq(6).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var vegetation =  feature.eq(7).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    var soil =        feature.eq(8).selfMask().reduceRegion(ee.Reducer.count()).values().get(0)
    // save counts as numbers
    var n_ice =         ee.Number.parse(ice);
    var n_snow =        ee.Number.parse(snow);
    var n_water =       ee.Number.parse(water);
    var n_shd_snow =    ee.Number.parse(shd_snow);
    var n_shd_ice =     ee.Number.parse(shd_ice);
    var n_thin_ice =    ee.Number.parse(thin_ice);
    var n_vegetation =  ee.Number.parse(vegetation);
    var n_soil =        ee.Number.parse(soil);
    // add up numbers
    var n_covered = n_ice.add(n_snow).add(n_shd_snow).add(n_shd_ice).add(n_thin_ice);
    var n_total = n_covered.add(n_water);
    var n_prop_snow = (n_snow.add(n_shd_snow)).divide(n_total).multiply(100);
    var n_prop_ice = (n_ice.add(n_shd_ice).add(n_thin_ice)).divide(n_total).multiply(100);
    var n_prop_water = (n_water).divide(n_total).multiply(100);
    var n_prop_cov = (n_covered).divide(n_total).multiply(100);
    var time = feature.get('system:time_start');
    // Create new feature with desired properties.
    var data = ee.Feature(null, {
      'proportion': n_prop_cov,
      'prop_snow': n_prop_snow,
      'prop_ice': n_prop_ice,
      'prop_water': n_prop_water,
      'sensor': 'S2',
      'system:time_start': time,
      'date': ee.Date(time).format("yyyy-MM-dd")
    })
    return(data)
  });
  // Get properties as lists.
  var list_prop_cov = result_wratio.aggregate_array('proportion')
  var list_prop_snow = result_wratio.aggregate_array('prop_snow')
  var list_prop_ice = result_wratio.aggregate_array('prop_ice')
  var list_prop_water = result_wratio.aggregate_array('prop_water')
  var array = ee.Array.cat([list_prop_snow, list_prop_ice, list_prop_water],1)
  var list_time = result_wratio.aggregate_array('system:time_start')
  // Export data
  Export.table.toDrive({
  collection: result_wratio,
  description:'export_S2_chartdata',
  folder: 'Earth Engine',
  fileNamePrefix: 'chart_S2'
  });
  // Define and plot the proportion of covered lake area over time.
  var scatterplot = ui.Chart.array
    .values({array: array, axis: 0, xLabels: list_time})
    .setOptions({
      title: 'Proportion of covered Lake Area over Time',
      //colors: ['yellow', 'red', 'blue'],
      hAxis: {
        title: 'Date',
        titleTextStyle: {italic: false, bold: true},
      },
      vAxis: {
        title: 'Lake coverage [%]',
        titleTextStyle: {italic: false, bold: true},
        minValue: 0,
        maxValue: 100
      },
      pointSize: 4,
      lineSize: 2,
      //dataOpacity: 0.4,
      legend: {position: 'none'},
      //curveType: 'function'
  });
  print(scatterplot);
}

exports.plotCoverageAuto = function(imagecoll){
  // Get proportion of covered lake and add it to images as property.
  var result_wratio = imagecoll.map(function(im) {
    var lake = ee.Geometry(im.get('lakemask'))
    var scale = 20
    var covered = im
    .eq(1)
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: lake,
    scale: scale,
    maxPixels: 1e15,
    tileScale: 10
    })
    .values()
    .get(0)
    var water = im
    .eq(0)
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: lake,
    scale: scale,
    maxPixels: 1e15,
    tileScale: 10
    })
    .values()
    .get(0)
    // Save counts as numbers.
    var n_covered = ee.Number.parse(covered)
    var n_water = ee.Number.parse(water)
    var n_total = n_covered.add(n_water)
    var n_prop = n_covered.divide(n_total).multiply(100)
    var time = im.get('system:time_start')
    var coverage = ee.Number(im.get('coverage'));
    // Set numbers as new image properties.
    var data = ee.Feature(null, {
      'proportion': n_prop,
      'sensor': 'S2',
      'coverage': coverage,
      'system:time_start': time,
      'date': ee.Date(time).format("yyyy-MM-dd")
    })
    return(data)
  });
  // Get properties as lists.
  //print('result_wratio', result_wratio)
  var list_prop = result_wratio.aggregate_array('proportion');
  var list_time = result_wratio.aggregate_array('system:time_start');
  // Export data
  Export.table.toDrive({
  collection: result_wratio,
  description:'export_S2_chartdata',
  folder: 'Earth Engine',
  fileNamePrefix: 'chart_S2'
  });
  // Define and plot the proportion of covered lake area over time.
  var scatterplot = ui.Chart.array
    .values({array: list_prop, axis: 0, xLabels: list_time})
    .setOptions({
      title: 'Proportion of covered Lake Area over Time',
      colors: ['cf513e'],
      hAxis: {
        title: 'Date',
        titleTextStyle: {italic: false, bold: true},
      },
      vAxis: {
        title: 'Lake coverage [%]',
        titleTextStyle: {italic: false, bold: true},
        minValue: 0,
        maxValue: 100
      },
      pointSize: 4,
      lineSize: 2,
      //dataOpacity: 0.4,
      legend: {position: 'none'},
  });
  print(scatterplot);
}

exports.exportCoverage = function(imagecoll){
  // Get proportion of covered lake and add it to images as property.
  var result_wratio = imagecoll.map(function(im) {
    var lake = ee.Geometry(im.get('lakemask'))
    var centroid = lake.centroid(10)
    var scale = 20
    var covered = im
    .eq(1)
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: lake,
    scale: scale,
    maxPixels: 1e15,
    tileScale: 10
    })
    .values()
    .get(0)
    var water = im
    .eq(0)
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: lake,
    scale: scale,
    maxPixels: 1e15,
    tileScale: 10
    })
    .values()
    .get(0)
    // Save counts as numbers.
    var n_covered = ee.Number.parse(covered)
    var n_water = ee.Number.parse(water)
    var n_total = n_covered.add(n_water)
    var n_prop = n_covered.divide(n_total).multiply(100)
    var time = im.get('system:time_start')
    var coverage = ee.Number(im.get('coverage'));
    // Set numbers as new image properties.
    var data = ee.Feature(null, {
      'im_id': im.get('system:index'),
      'proportion': n_prop,
      'sensor': 'S2',
      'coverage': coverage,
      'system:time_start': time,
      'date': ee.Date(time).format("yyyy-MM-dd")
    })
    return(data)
  });
  return(ee.FeatureCollection(result_wratio))
}