exports.addIndicesL7 = function(img) {
  // Bands
  var red = img.select('SR_B3');
  var green = img.select('SR_B2')
  var blue = img.select('SR_B1');
  var nir = img.select('SR_B4');
  var swir = img.select('SR_B5');
  var mir = img.select('SR_B7')
  // Indices (normalizedDifference() not used since values are capped to [-1, -1])
  var BSI = ((swir.add(red)).subtract(nir.add(blue))).divide((swir.add(red)).add(nir.add(blue))).rename('BSI').multiply(10000).toInt16();
  var NDWI = green.subtract(nir).divide(green.add(nir)).rename('NDWI').multiply(10000).toInt16();
  var mNDWI = green.subtract(mir).divide(green.add(mir)).rename('mNDWI').multiply(10000).toInt16();
  var NDSI_unscaled = green.subtract(swir).divide(green.add(swir)).rename('NDSI')
  var NDSI = NDSI_unscaled.multiply(10000).toInt16();
  var NDVI = nir.subtract(red).divide(nir.add(red)).rename('NDVI').multiply(10000).toInt16();
  // Fractional Snow Cover from NDSI 
  // FSC can be represented with a sigmoid-shaped function 0.5 × tanh(a × NDSI + b) + 0.5, where a = 2.65 and b = −1.42
  // Estimating Fractional Snow Cover in Open Terrain from Sentinel-2 Using the Normalized Difference Snow Index
  // Remote Sens. 2020, 12(18), 2904; https://doi.org/10.3390/rs12182904
  var a = 2.65
  var b = -1.42
  var FSC = (NDSI_unscaled.multiply(a).add(b)).tanh().multiply(0.5).add(0.5).rename('FSC').multiply(10000).toInt16()
  // Add bands to image
  img = img.addBands([NDWI, mNDWI, NDSI, NDVI, BSI]);
  return(img);
};

var addIndicesL7 = function(img) {
  // Bands
  var red = img.select('SR_B3');
  var green = img.select('SR_B2')
  var blue = img.select('SR_B1');
  var nir = img.select('SR_B4');
  var swir = img.select('SR_B5');
  var mir = img.select('SR_B7')
  // Indices (normalizedDifference() not used since values are capped to [-1, -1])
  var BSI = ((swir.add(red)).subtract(nir.add(blue))).divide((swir.add(red)).add(nir.add(blue))).rename('BSI').multiply(10000).toInt16();
  var NDWI = green.subtract(nir).divide(green.add(nir)).rename('NDWI').multiply(10000).toInt16();
  var mNDWI = green.subtract(mir).divide(green.add(mir)).rename('mNDWI').multiply(10000).toInt16();
  var NDSI_unscaled = green.subtract(swir).divide(green.add(swir)).rename('NDSI')
  var NDSI = NDSI_unscaled.multiply(10000).toInt16();
  var NDVI = nir.subtract(red).divide(nir.add(red)).rename('NDVI').multiply(10000).toInt16();
  // Fractional Snow Cover from NDSI 
  // FSC can be represented with a sigmoid-shaped function 0.5 × tanh(a × NDSI + b) + 0.5, where a = 2.65 and b = −1.42
  // Estimating Fractional Snow Cover in Open Terrain from Sentinel-2 Using the Normalized Difference Snow Index
  // Remote Sens. 2020, 12(18), 2904; https://doi.org/10.3390/rs12182904
  var a = 2.65
  var b = -1.42
  var FSC = (NDSI_unscaled.multiply(a).add(b)).tanh().multiply(0.5).add(0.5).rename('FSC').multiply(10000).toInt16()
  // Add bands to image
  img = img.addBands([NDWI, mNDWI, NDSI, NDVI, BSI]);
  return(img);
};

exports.addOptTexturesL7 = function(image){
  // Add the 10 most important textures of the 2 most important bands (native bands w/ indices)
  var image_int32 = image.select(['ST_B6', 'NDSI'])/*.multiply(ee.Image([1000, 1000]))*/.cast({VH:'int32', VV:'int32'})
  // define kernels with pixel sizes of 3x3, 5x5, 7x7 (Note: kernels are defined in radii!)
  var sq3 = ee.Kernel.square({radius: 1});
  var sq5 = ee.Kernel.square({radius: 2});
  var sq7 = ee.Kernel.square({radius: 3});
  // add Entropy for ST_B6 band with window sizes: 3, 5 and 7
  var ent3_ST_B6 = image_int32.select('ST_B6').entropy(sq3).rename('ST_B6_ENTR_3x3')
  var ent5_ST_B6 = image_int32.select('ST_B6').entropy(sq5).rename('ST_B6_ENTR_5x5')
  var ent7_ST_B6 = image_int32.select('ST_B6').entropy(sq7).rename('ST_B6_ENTR_7x7')
  //image = image.addBands(ent3_ST_B6);
  //image = image.addBands(ent5_ST_B6);
  image = image.addBands(ent7_ST_B6);
  // add Entropy for NDSI band with window sizes: 3, 5 and 7
  var ent3_NDSI = image_int32.select('NDSI').entropy(sq3).rename('NDSI_ENTR_3x3')
  var ent5_NDSI = image_int32.select('NDSI').entropy(sq5).rename('NDSI_ENTR_5x5')
  var ent7_NDSI = image_int32.select('NDSI').entropy(sq7).rename('NDSI_ENTR_7x7')
  //image = image.addBands(ent3_NDSI);
  //image = image.addBands(ent5_NDSI);
  //image = image.addBands(ent7_NDSI);
  // add GLCM for NDSI with window sizes: 3, 5 and 7
  var glcm3_NDSI = image_int32.select('NDSI').glcmTexture({size: 1}).rename(['NDSI_asm_3x3', 'NDSI_contrast_3x3', 'NDSI_corr_3x3', 'NDSI_var_3x3', 'NDSI_idm_3x3', 'NDSI_savg_3x3', 'NDSI_svar_3x3', 'NDSI_sent_3x3', 'NDSI_ent_3x3', 'NDSI_dvar_3x3', 'NDSI_dent_3x3', 'NDSI_imcorr1_3x3', 'NDSI_imcorr2_3x3', 'NDSI_maxcorr_3x3', 'NDSI_diss_3x3', 'NDSI_inertia_3x3', 'NDSI_shade_3x3', 'NDSI_prom_3x3']);
  var glcm5_NDSI = image_int32.select('NDSI').glcmTexture({size: 2}).rename(['NDSI_asm_5x5', 'NDSI_contrast_5x5', 'NDSI_corr_5x5', 'NDSI_var_5x5', 'NDSI_idm_5x5', 'NDSI_savg_5x5', 'NDSI_svar_5x5', 'NDSI_sent_5x5', 'NDSI_ent_5x5', 'NDSI_dvar_5x5', 'NDSI_dent_5x5', 'NDSI_imcorr1_5x5', 'NDSI_imcorr2_5x5', 'NDSI_maxcorr_5x5', 'NDSI_diss_5x5', 'NDSI_inertia_5x5', 'NDSI_shade_5x5', 'NDSI_prom_5x5']);
  var glcm7_NDSI = image_int32.select('NDSI').glcmTexture({size: 3}).rename(['NDSI_asm_7x7', 'NDSI_contrast_7x7', 'NDSI_corr_7x7', 'NDSI_var_7x7', 'NDSI_idm_7x7', 'NDSI_savg_7x7', 'NDSI_svar_7x7', 'NDSI_sent_7x7', 'NDSI_ent_7x7', 'NDSI_dvar_7x7', 'NDSI_dent_7x7', 'NDSI_imcorr1_7x7', 'NDSI_imcorr2_7x7', 'NDSI_maxcorr_7x7', 'NDSI_diss_7x7', 'NDSI_inertia_7x7', 'NDSI_shade_7x7', 'NDSI_prom_7x7']);
  image = image.addBands(glcm3_NDSI.select(['NDSI_savg_3x3']));
  image = image.addBands(glcm5_NDSI.select(['NDSI_savg_5x5', 'NDSI_dvar_5x5']));
  image = image.addBands(glcm7_NDSI.select(['NDSI_savg_7x7', 'NDSI_contrast_7x7']));
  // add GLCM for ST_B6 with window sizes: 3, 5 and 7
  var glcm3_ST_B6 = image_int32.select('ST_B6').glcmTexture({size: 1}).rename(['ST_B6_asm_3x3', 'ST_B6_contrast_3x3', 'ST_B6_corr_3x3', 'ST_B6_var_3x3', 'ST_B6_idm_3x3', 'ST_B6_savg_3x3', 'ST_B6_svar_3x3', 'ST_B6_sent_3x3', 'ST_B6_ent_3x3', 'ST_B6_dvar_3x3', 'ST_B6_dent_3x3', 'ST_B6_imcorr1_3x3', 'ST_B6_imcorr2_3x3', 'ST_B6_maxcorr_3x3', 'ST_B6_diss_3x3', 'ST_B6_inertia_3x3', 'ST_B6_shade_3x3', 'ST_B6_prom_3x3']);
  var glcm5_ST_B6 = image_int32.select('ST_B6').glcmTexture({size: 2}).rename(['ST_B6_asm_5x5', 'ST_B6_contrast_5x5', 'ST_B6_corr_5x5', 'ST_B6_var_5x5', 'ST_B6_idm_5x5', 'ST_B6_savg_5x5', 'ST_B6_svar_5x5', 'ST_B6_sent_5x5', 'ST_B6_ent_5x5', 'ST_B6_dvar_5x5', 'ST_B6_dent_5x5', 'ST_B6_imcorr1_5x5', 'ST_B6_imcorr2_5x5', 'ST_B6_maxcorr_5x5', 'ST_B6_diss_5x5', 'ST_B6_inertia_5x5', 'ST_B6_shade_5x5', 'ST_B6_prom_5x5']);
  var glcm7_ST_B6 = image_int32.select('ST_B6').glcmTexture({size: 3}).rename(['ST_B6_asm_7x7', 'ST_B6_contrast_7x7', 'ST_B6_corr_7x7', 'ST_B6_var_7x7', 'ST_B6_idm_7x7', 'ST_B6_savg_7x7', 'ST_B6_svar_7x7', 'ST_B6_sent_7x7', 'ST_B6_ent_7x7', 'ST_B6_dvar_7x7', 'ST_B6_dent_7x7', 'ST_B6_imcorr1_7x7', 'ST_B6_imcorr2_7x7', 'ST_B6_maxcorr_7x7', 'ST_B6_diss_7x7', 'ST_B6_inertia_7x7', 'ST_B6_shade_7x7', 'ST_B6_prom_7x7']);
  image = image.addBands(glcm3_ST_B6.select(['ST_B6_savg_3x3']));
  image = image.addBands(glcm5_ST_B6.select(['ST_B6_savg_5x5']));
  image = image.addBands(glcm7_ST_B6.select(['ST_B6_savg_7x7', 'ST_B6_imcorr2_7x7']));
  return(image)
}

exports.addOptTemporalDevStatsL7 = function(image){
  // Local masking function
  var maskL7sr = function(img) {
    // Bits 4 and 3 are cloud shadow and cloud, respectively.
    var cloudShadowBitMask = (1 << 4);
    var cloudsBitMask = (1 << 3);
    // Get the pixel QA band.
    var qa = img.select('QA_PIXEL');
    // Both flags should be set to zero, indicating clear conditions.
    var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                   .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
    return img.updateMask(mask);
  };
  
  // Load imagecollection
  var images = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
    .map(maskL7sr) //Filter for clouds with bitmask
    .map(addIndicesL7)
    
  // Yearly coll
  var date = ee.Date(image.get('system:time_start'));
  var start = date.advance(-182.5, 'day');
  var end =  date.advance(182.5, 'day');
  var yearlyColl = images
    .filterDate(start, end)
  // reduce yearly imagecollection to n-th percentile image
  var p = [10, 30, 50, 70, 90];
  var NDSIperc = yearlyColl.select('NDSI').reduce(ee.Reducer.percentile(p));
  var ST_B6perc = yearlyColl.select('ST_B6').reduce(ee.Reducer.percentile(p));
   
  // Find deviation from two-weekly to yearly
  start = date.advance(-7, 'day');
  end =  date.advance(7, 'day');
  var twoWeeklyColl = images
    .filterDate(start, end)
  
  var NDSItwmean = twoWeeklyColl.select('NDSI').reduce(ee.Reducer.mean()).select('NDSI_mean');
  var ST_B6twmean = twoWeeklyColl.select('ST_B6').reduce(ee.Reducer.mean()).select('ST_B6_mean');
  var NDSItw_p10 = NDSItwmean.subtract(NDSIperc.select('NDSI_p10')).rename('NDSItw_p10');
  var ST_B6tw_p10 = ST_B6twmean.subtract(ST_B6perc.select('ST_B6_p10')).rename('ST_B6tw_p10');
  var NDSItw_p30 = NDSItwmean.subtract(NDSIperc.select('NDSI_p30')).rename('NDSItw_p30');
  var ST_B6tw_p30 = ST_B6twmean.subtract(ST_B6perc.select('ST_B6_p30')).rename('ST_B6tw_p30');
  var NDSItw_p50 = NDSItwmean.subtract(NDSIperc.select('NDSI_p50')).rename('NDSItw_p50');
  var ST_B6tw_p50 = ST_B6twmean.subtract(ST_B6perc.select('ST_B6_p50')).rename('ST_B6tw_p50');
  var NDSItw_p70 = NDSItwmean.subtract(NDSIperc.select('NDSI_p70')).rename('NDSItw_p70');
  var ST_B6tw_p70 = ST_B6twmean.subtract(ST_B6perc.select('ST_B6_p70')).rename('ST_B6tw_p70');
  var NDSItw_p90 = NDSItwmean.subtract(NDSIperc.select('NDSI_p90')).rename('NDSItw_p90');
  var ST_B6tw_p90 = ST_B6twmean.subtract(ST_B6perc.select('ST_B6_p90')).rename('ST_B6tw_p90');
  var list = [NDSItw_p10, ST_B6tw_p10, NDSItw_p30, ST_B6tw_p30, NDSItw_p50, ST_B6tw_p50, NDSItw_p70, ST_B6tw_p70, NDSItw_p90, ST_B6tw_p90];
  return(image.addBands(list));
};

// Cloudmasking using CFMASK bitmasks
exports.maskL7sr = function(img) {
  // Bits 4 and 3 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = (1 << 4);
  var cloudsBitMask = (1 << 3);
  // Get the pixel QA band.
  var qa = img.select('QA_PIXEL');
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                 .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return img.updateMask(mask);
};



exports.plotCoverage = function(featurecollection){
  // Get proportion of covered lake and add it to images as property.
  var result_wratio = featurecollection.map(function(feature) {
    var covered = feature
    .eq(1)
    .selfMask()
    .reduceRegion({
      reducer: ee.Reducer.count(),
      scale: 30
    })
    .values()
    .get(0)
    var water = feature
    .eq(0)
    .selfMask()
    .reduceRegion({
      reducer: ee.Reducer.count(),
      scale: 30
    })
    .values()
    .get(0)
    // Save counts as numbers.
    var n_covered = ee.Number.parse(covered)
    var n_water = ee.Number.parse(water)
    var n_total = n_covered.add(n_water)
    var n_prop = n_covered.divide(n_total).multiply(100)
    var time = feature.get('system:time_start')
    var coverage = feature.get('coverage');
    // Set numbers as new image properties.
    var data = ee.Feature(null, {
      'proportion': n_prop,
      'sensor': 'L7',
      'coverage': coverage,
      'system:time_start': time,
      'date': ee.Date(time).format("yyyy-MM-dd")
    });
    return(data);
  });
  // Get properties as lists.
  //print('result_wratio', result_wratio)
  var list_prop = result_wratio.aggregate_array('proportion');
  var list_time = result_wratio.aggregate_array('system:time_start');
  // Export data
  Export.table.toDrive({
  collection: result_wratio,
  description:'export_L7_chartdata',
  folder: 'Earth Engine',
  fileNamePrefix: 'chart_L7'
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
    var scale = 30
    var covered = im
    .eq(1)
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: lake,
    scale: scale,
    maxPixels: 1e15
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
    maxPixels: 1e15
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
      'sensor': 'L7',
      'coverage': coverage,
      'system:time_start': time,
      'date': ee.Date(time).format("yyyy-MM-dd")
    });
    return(data);
  });
  return(ee.FeatureCollection(result_wratio))
}

exports.addDoy = function(img) {
  var year = ee.Date(img.get('system:time_start')).get('year').format()
  var doy = ee.Date(img.get('system:time_start')).getRelative('day', 'year').format()
  var yearAndDoy = ee.String(year.cat('-').cat(doy))
  return(img.set({'doy':yearAndDoy}))
}

exports.addEra5DailyAggregate = function(im){
  /* Creates the daily aggregate (mean/sum) from ERA5-Land Hourly and adds it to the input image as band.
  Instead of using the ERA5 Daily Aggregates directly this method will retain the higher resolution
  and the better update intervals from the hourly dataset.*/
  var im_extent = im.geometry();
  var date = im.date();
  var day = ee.Date.parse('YYYY-MM-dd', date.format('YYYY-MM-dd'));
  var era5hourly = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").filterDate(day, day.advance(1, 'day'));
  var era5hourly_2mt = era5hourly.select('temperature_2m');
  var era5daily_2mt = era5hourly_2mt.mean().rename('ERA5_t2m').clip(im_extent);
  return(im.addBands(era5daily_2mt));
};
  