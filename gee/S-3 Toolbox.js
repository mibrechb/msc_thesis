function bitwiseExtract(value, fromBit, toBit) {
  if (toBit === undefined)
    toBit = fromBit
  var maskSize = ee.Number(1).add(toBit).subtract(fromBit)
  var mask = ee.Number(1).leftShift(maskSize).subtract(1)
  return value.rightShift(fromBit).bitwiseAnd(mask)
}

exports.cloudMaskwMOD09 = function(image){
  // cloud masking with same day MODIS image
  // daily aggregate has no accurate flyover time only date
  // dt_mod_min gives wrong values
  var crs = image.select(0).projection()
  var time = image.date()
  var day = time.format('YYYY-MM-dd')
  var imCenter = image.geometry(1000).centroid()
  var modisQA = ee.ImageCollection("MODIS/006/MOD09GA")
    .filterDate(day)
    .first()
    .select('state_1km')
  var bitMask = bitwiseExtract(modisQA, 0, 1)
  // Return an image masking out cloudy areas.
  var cloudmask = bitMask.neq(1)//.reproject(crs)
  image = image.updateMask(cloudmask).set('modis_time', modisQA.date())
  return image
}

// Cloud Displacement buffer for cloud masks
exports.addCloudBuffer = function(img){
  var crs = img.select(0).projection()
  var time = img.date()
  var day = time.format('YYYY-MM-dd')
  var dt_min = ee.Number.parse(img.get('dt_minutes')) // observation delay from 
  var dt_sec = dt_min.multiply(60)
  var era5 = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").filterDate(time).first()
  var u = era5.select('u_component_of_wind_10m').multiply(dt_sec)
  var v = era5.select('v_component_of_wind_10m').multiply(dt_sec)
  var displacement = ee.Image.cat([u,v])
  var cloudmask = img.mask()
  var buffer = cloudmask.displace(displacement, 'nearest_neighbor')
  return(img.updateMask(buffer))
}

// Cloud Displacement buffer for cloud masks
exports.addCloudBufferStepwise = function(img){
  var crs = img.select(0).projection()
  var time = img.date()
  var day = time.format('YYYY-MM-dd')
  var dt_min = ee.Number.parse(img.get('dt_minutes')) // observation delay from 
  var dt_sec = dt_min.multiply(60)
  var era5 = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").filterDate(time).first()
  var u = era5.select('u_component_of_wind_10m').multiply(dt_sec)
  var v = era5.select('v_component_of_wind_10m').multiply(dt_sec)
  // Calculate buffered cloudmasks in steps
  var steps = 10
  var steps_seq = ee.List.sequence(1, steps)
  var buffer_step = steps_seq.map(function(step){
    var rel_step = step.divide(steps)
    var u_step = u.multiply(rel_step)
    var v_step = v.multiply(rel_step)
    var displacement = ee.Image.cat([u,v])
    var cloudmask = img.mask()
    var buffer = cloudmask.displace(displacement, 'nearest_neighbor')
    return(buffer)
  })
  // Combine all masks
  var buffer_combined = buffer_step.reduce(ee.Reducer.allNonZero())
  return(img.updateMask(buffer_combined))
}

// Function to filter imagecollection for a range of hours a day and only return one image per day
exports.getDistinctImgsAtSpecTime = function(imgcol, start, end){
  imgcol = imgcol.map(function(img){
    var day = img.date().format('YYYY-MM-dd')
    return(img.set('day', day))
  })
  imgcol = imgcol.filter(ee.Filter.calendarRange(start, end, 'hour')) // filter collection for hour of day
  imgcol = imgcol.distinct('day') // filter collection to get only one image per day
  return(imgcol)
}

var findMOD11 = exports.findMOD11 = function(image){
   // get S-3 image properties
  var geom = image.geometry()
  var time = image.date()
  var day = time.format('YYYY-MM-dd')
  
  // load MOD11 collection and filter for AOI and day
  var mod11 = ee.ImageCollection("MODIS/006/MOD11A1")
    .filterDate(day)
    .filter(ee.Filter.contains({rightValue: geom, leftField:".geo"}))
    .first()
    
  // get mean acquisition time over images from MOD11 and calculate the difference to S-3 in minutes and add it to S-3 image
  var time_mod11 = mod11.select('Day_view_time')
  var time_mod11_mean = time_mod11
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: geom,
      scale: 1000,
      tileScale: 10,
      maxPixels: 25000000,
      bestEffort: true
    })
    .values()
    .get(0)
  var id = mod11.id()
  var s3_minutes = time.getRelative('minute', 'day')
  var dt_minutes = ee.Algorithms.If(time_mod11_mean, ee.Number.parse(time_mod11_mean).multiply(6).subtract(s3_minutes), ee.Number(0))
  var dt_minutes_abs = ee.Number(dt_minutes).abs()
  
  // add time delay to S-3 property
  image = image.set('dt_minutes', dt_minutes).set('dt_minutes_abs', dt_minutes_abs).set('mod11_id', id)
  return(image)
}

exports.cloudMaskwMOD11v2 = function(image){
  // function to add a buffer to an images mask with ERA5 10m-wind vectors
  var bufferMask = function(img){
    var time = img.date();
    var crs = img.select(0).projection(); // crs of S-3;
    var start = time;
    var day = time.format('YYYY-MM-dd');
    var hour = time.format("YYYY-MM-dd'T'HH:00");
    var dt_min = ee.Number.parse(img.get('dt_minutes')); // observation delay from [min]
    var end = start.advance(dt_min, 'minutes'); // acquisition of S-3 + delay
    var dt_sec = dt_min.multiply(60); // observation delay [sec]
    var era5 = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").filterDate(hour/*time, end*/).select('u_component_of_wind_10m', 'v_component_of_wind_10m').mean();
    var u = era5.select('u_component_of_wind_10m').multiply(dt_sec); // wind in horizontal direction
    var v = era5.select('v_component_of_wind_10m').multiply(dt_sec); // wind in vertical direction
    var displacement = ee.Image.cat([u,v]); // displace the image according to u- and v-vectors
    var cloudmask = img.mask();
    var buffer = cloudmask.displace(displacement, 'nearest_neighbor'); // displace cloudmask with wind vectors
    var change = cloudmask.subtract(buffer)
    var changemask = change.eq(ee.Image.constant(-1))
    var combined = cloudmask.add(changemask)
    return(img.updateMask(combined));
  };
  // get MOD11 delay and MOD11 ID
  var dt_min = ee.Number.parse(image.get('mod11_id'));
  var id = image.get('mod11_id');
  var geom = image.geometry();
  // load MOD11 collection and filter for ID
  var mod11 = ee.ImageCollection("MODIS/006/MOD11A1")
    .filter(ee.Filter.eq('system:index', id))
    .first()
  var modisQA = mod11.select('QC_Day')
  //mod11 = mod11.select('Day_view_time');
  // calcuate buffered cloudmask and update image mask with it
  var bitMask = bitwiseExtract(modisQA, 0, 1);
  // Return an image masking out cloudy areas.
  var cloudmask = bitMask.neq(2).clip(geom);
  image = image.updateMask(cloudmask);
  image = bufferMask(image);
  return(image);
};

var cloudMaskwMOD11v4 = exports.cloudMaskwMOD11v4 = function(image){
  /* Gets most recent MOD11 cloudmask and buffers the clouds with ERA5 wind speed and the delay time to S3 acquisitions.
  The buffered MOD11 cloudmask is then combined with S3 bright pixel QA-flag to mask all bright pixels that are within the buffered cloudmask.*/
  // get MOD11 delay and MOD11 ID
  var id = image.get('mod11_id');
  var geom = image.geometry();
  
  // Load MOD11 collection and filter for ID
  var mod11 = ee.ImageCollection("MODIS/006/MOD11A1")
    .filter(ee.Filter.eq('system:index', id))
    .first()
  
  // Get cloudy MOD11 pixels from QA-flag
  var modisQA = mod11.select('QC_Day')
  var bitMask = bitwiseExtract(modisQA, 0, 1);
  var cloudmask = bitMask.neq(2).clip(geom);
  
  // Calculate buffered pixels with cloud movement calculated from ERA5 wind speed and time delay to S3 acquisiton.
  var time = image.date();
  var crs = image.select(0).projection(); // crs of S-3;
  var start = time;
  var day = time.format('YYYY-MM-dd');
  var hour = time.format("YYYY-MM-dd'T'HH:00");
  var dt_min = ee.Number.parse(image.get('dt_minutes')); // observation delay from [min]
  var end = start.advance(dt_min, 'minutes'); // acquisition of S-3 + delay
  var dt_sec = dt_min.multiply(60); // observation delay [sec]
  var era5 = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").filterDate(hour/*time, end*/).select('u_component_of_wind_10m', 'v_component_of_wind_10m').mean();
  var u = era5.select('u_component_of_wind_10m').multiply(dt_sec); // wind in horizontal direction
  var v = era5.select('v_component_of_wind_10m').multiply(dt_sec); // wind in vertical direction
  // Calculate buffered cloudmasks in n steps
  var mask = cloudmask
  var steps = 50
  var steps_seq = ee.List.sequence(0, steps)
  var buffer_steps = ee.ImageCollection(steps_seq.map(function(step){
    step = ee.Number(step)
    var rel_step = step.divide(steps)
    var u_step = u.multiply(rel_step)
    var v_step = v.multiply(rel_step)
    var displacement = ee.Image.cat([u_step,v_step])
    var buffer = mask.displace(displacement, 'nearest_neighbor')
    return(ee.Image(buffer))
  }))
  // Combine buffermask collection
  var buffer_combined = buffer_steps.reduce(ee.Reducer.min()) // 0: within mask of at least one buffer-step, >=1: never masked
  // Get bright pixel mask from S3 QA-flags
  var brightPx_bitMask = bitwiseExtract(image.unmask().select('QA'), 27).eq(0); // 0: bright pixel, 1: not bright pixel
  // Combine cloud-buffermask with S3 bright pixel mask
  var combined_mask = buffer_combined.add(brightPx_bitMask).neq(0)// mask all S3 bright pixel within MOD11 buffer-mask
  return(image.updateMask(combined_mask));
};

exports.cloudMaskwMOD11v4noBrightPx = function(image){
  /* Gets most recent MOD11 cloudmask and buffers the clouds with ERA5 wind speed and the delay time to S3 acquisitions.
  The buffered MOD11 cloudmask is then combined with S3 bright pixel QA-flag to mask all bright pixels that are within the buffered cloudmask.*/
  // get MOD11 delay and MOD11 ID
  var id = image.get('mod11_id');
  var geom = image.geometry();
  
  // Load MOD11 collection and filter for ID
  var mod11 = ee.ImageCollection("MODIS/006/MOD11A1")
    .filter(ee.Filter.eq('system:index', id))
    .first()
  
  // Get cloudy MOD11 pixels from QA-flag
  var modisQA = mod11.select('QC_Day')
  var bitMask = bitwiseExtract(modisQA, 0, 1);
  var cloudmask = bitMask.neq(2).clip(geom);
  
  // Calculate buffered pixels with cloud movement calculated from ERA5 wind speed and time delay to S3 acquisiton.
  var time = image.date();
  var crs = image.select(0).projection(); // crs of S-3;
  var start = time;
  var day = time.format('YYYY-MM-dd');
  var hour = time.format("YYYY-MM-dd'T'HH:00");
  var dt_min = ee.Number.parse(image.get('dt_minutes')); // observation delay from [min]
  var end = start.advance(dt_min, 'minutes'); // acquisition of S-3 + delay
  var dt_sec = dt_min.multiply(60); // observation delay [sec]
  var era5 = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").filterDate(hour/*time, end*/).select('u_component_of_wind_10m', 'v_component_of_wind_10m').mean();
  var u = era5.select('u_component_of_wind_10m').multiply(dt_sec); // wind in horizontal direction
  var v = era5.select('v_component_of_wind_10m').multiply(dt_sec); // wind in vertical direction
  // Calculate buffered cloudmasks in n steps
  var mask = cloudmask
  var steps = 100
  var steps_seq = ee.List.sequence(0, steps)
  var buffer_steps = ee.ImageCollection(steps_seq.map(function(step){
    step = ee.Number(step)
    var rel_step = step.divide(steps)
    var u_step = u.multiply(rel_step)
    var v_step = v.multiply(rel_step)
    var displacement = ee.Image.cat([u_step,v_step])
    var buffer = mask.displace(displacement, 'nearest_neighbor')
    return(ee.Image(buffer))
  }))
  var buffer_combined = buffer_steps.reduce(ee.Reducer.min())
  return(image.updateMask(buffer_combined));
};

exports.addDoy = function(img) {
  var year = ee.Date(img.get('system:time_start')).get('year').format();
  var doy = ee.Date(img.get('system:time_start')).getRelative('day', 'year').format();
  var yearAndDoy = ee.String(year.cat('-').cat(doy));
  return(img.set({'doy':yearAndDoy}));
};

// add property unbounded with true or false
var unboundedCheck = exports.unboundedCheck = function(img){
  var check = img.geometry().isUnbounded();
  return(img.set('unbounded', check));
};

exports.addOptTemporalDevStatsS3 = function(image){
  // Load, rename and cast imagecoll
  var bands = ee.List(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'QA'])
  var bandtypes = ee.List(['int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'int32', 'uint32'])
  var images = ee.ImageCollection("COPERNICUS/S3/OLCI")
    .map(unboundedCheck)
    .filterMetadata('unbounded', 'not_equals', true)
    .map(function(image){return image.rename(bands).cast(ee.Dictionary.fromLists(bands, bandtypes))})
    .map(findMOD11)
    .map(cloudMaskwMOD11v4)
  // Yearly coll
  var date = ee.Date(image.get('system:time_start'));
  var start = date.advance(-182.5, 'day');
  var end =  date.advance(182.5, 'day');
  var yearlyColl = images
    .filterDate(start, end)
  // reduce yearly imagecollection to n-th percentile image
  var p = [10, 30, 50, 70, 90];
  var B2perc = yearlyColl.select('B2').reduce(ee.Reducer.percentile(p));
  var B21perc = yearlyColl.select('B21').reduce(ee.Reducer.percentile(p));
   
  // Find deviation from two-weekly to yearly
  start = date.advance(-7, 'day');
  end =  date.advance(7, 'day');
  var twoWeeklyColl = images
    .filterDate(start, end)
  
  var B2twmean = twoWeeklyColl.select('B2').reduce(ee.Reducer.mean()).select('B2_mean');
  var B21twmean = twoWeeklyColl.select('B21').reduce(ee.Reducer.mean()).select('B21_mean');
  var B2tw_p10 = B2twmean.subtract(B2perc.select('B2_p10')).rename('B2tw_p10');
  var B21tw_p10 = B21twmean.subtract(B21perc.select('B21_p10')).rename('B21tw_p10');
  var B2tw_p30 = B2twmean.subtract(B2perc.select('B2_p30')).rename('B2tw_p30');
  var B21tw_p30 = B21twmean.subtract(B21perc.select('B21_p30')).rename('B21tw_p30');
  var B2tw_p50 = B2twmean.subtract(B2perc.select('B2_p50')).rename('B2tw_p50');
  var B21tw_p50 = B21twmean.subtract(B21perc.select('B21_p50')).rename('B21tw_p50');
  var B2tw_p70 = B2twmean.subtract(B2perc.select('B2_p70')).rename('B2tw_p70');
  var B21tw_p70 = B21twmean.subtract(B21perc.select('B21_p70')).rename('B21tw_p70');
  var B2tw_p90 = B2twmean.subtract(B2perc.select('B2_p90')).rename('B2tw_p90');
  var B21tw_p90 = B21twmean.subtract(B21perc.select('B21_p90')).rename('B21tw_p90');
  var list = [B2tw_p10, B21tw_p10, B2tw_p30, B21tw_p30, B2tw_p50, B21tw_p50, B2tw_p70, B21tw_p70, B2tw_p90, B21tw_p90];
  return(image.addBands(list));
};

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

exports.plotCoverage = function(imagecoll){
  // Get proportion of covered lake and add it to images as property.
  var result_wratio = imagecoll.map(function(im) {
    var lake = ee.Geometry(im.get('lakemask'))
    var scale = 300
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
      'proportion': n_prop,
      'sensor': 'S3',
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
  description:'export_S3_chartdata',
  folder: 'Earth Engine',
  fileNamePrefix: 'chart_S3'
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
    var scale = 300
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
      'sensor': 'S3',
      'coverage': coverage,
      'system:time_start': time,
      'date': ee.Date(time).format("yyyy-MM-dd")
    })
    return(data)
  });
  return(ee.FeatureCollection(result_wratio))
}