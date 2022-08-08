exports.getLakeMasks = function(geometry, startDate, endDate){
  /*// Creates a featurecollection with the yearly lakemasks at the given geometry
  // starting from startDate (ee.Date) to endDate (ee.Date). Masks are generated with permanent water
  // pixels from the JRC v1.3 water mapping layers. For years above 2020 the 2020 lakemask is returned*/
  var startYear = startDate.get('year')
  var endYear = endDate.get('year')
  var yearList = ee.List.sequence(startYear, endYear)
  var getLakeMask = function(year){
    year = ee.Number(year).toInt()
    // JRC v1.3 is currently limited to 2020, lakemasks above are given as the 2020 mask
    var tempYear = ee.Algorithms.If(year.gt(2020), 2020, year)
    // get jrc image from specified year
    var im = ee.ImageCollection("JRC/GSW1_3/YearlyHistory")
    .filterMetadata('year', 'equals', tempYear)
    .toBands() // convert to image
    // mask all but permanent water pixels
    im = im.updateMask(im.eq(3))
    //Use reducer to convert raster to vector
    var mask = im.reduceToVectors({
      geometry: geometry.centroid().buffer(40000),
      geometryType: 'polygon',
      eightConnected: true,
    })
    .filterBounds(geometry)
    // If no polygon from JRC watermask is found use low-quality HydroLAKES geometry instead
    mask = ee.Algorithms.If(
      mask.size().eq(0),    //condition
      ee.Feature(geometry,{'year': year,'system:index': ee.String(year)}),           
      mask.sort('count', false).first().set('year', year).set('system:index', ee.String(year))
      )
    return(mask)
  }
  var lakeMasks = ee.FeatureCollection(yearList.map(getLakeMask))
  return(lakeMasks)
}
  
exports.cliplakeToYearlyMask = (function(im){
  /* Clips image to yearly lakemask */
  var lakemasks = im.get('lakemasks')
  var date = im.date()
  var year = ee.Number(date.get('year')).int()
  var lake = ee.FeatureCollection(lakemasks).filterMetadata('year', 'equals', year).first().geometry()
  im = im.clip(lake);
  im = im.set('lakemask', lake)
  return(im);
});

exports.scaleTo20m = function(im){
  /* Scales all bands of image do prefered resolution */
  var crs = im.select(0).projection().crs();
  im = im.reproject({
    crs: crs,
    scale: 20
  });
  return(im);
};

exports.scaleTo30m = function(im){
  /* Scales all bands of image do prefered resolution */
  var crs = im.select(0).projection().crs();
  im = im.reproject({
    crs: crs,
    scale: 30
  });
  return(im);
};

exports.scaleTo60m = function(im){
  /* Scales all bands of image do prefered resolution */
  var crs = im.select(0).projection().crs();
  im = im.reproject({
    crs: crs,
    scale: 60
  });
  return(im);
};

exports.scaleTo50m = function(im){
  /* Scales all bands of image do prefered resolution */
  var crs = im.select(0).projection().crs();
  im = im.reproject({
    crs: crs,
    scale: 50
  });
  return(im);
};


exports.scaleTo60m = function(im){
  /* Scales all bands of image do prefered resolution */
  var crs = im.select(0).projection().crs();
  im = im.reproject({
    crs: crs,
    scale: 60
  });
  return(im);
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

exports.addLakeCoverageRatiov2 = function(im){
  /* Gets lakemask from properties and adds relative are of non-null pixels covering lake */
  var lake = ee.Geometry(im.get('lakemask'))
  var lake_area = lake.area(10) // calculate lake area in m^2
  var unmasked_area = im.select(0) // calculate area of unmasked pixels
    .mask()
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: lake,
    scale: 100,
    maxPixels: 1e15
    })
    .values()
    .get(0)
  var px_ratio = ee.Number(unmasked_area).divide(lake_area)
  im = im.set('coverage', px_ratio);
  return(im);
};

exports.addLakeCoverageRatioSLIDE = function(im){
  /* Gets lakemask from properties and adds relative are of non-null pixels covering lake */
  var lake = ee.Geometry(im.get('lakemask'))
  var lake_area = lake.area(10) // calculate lake area in m^2
  var unmasked_area = im.select('BT1') // calculate area of unmasked pixels
    .mask()
    .multiply(ee.Image.pixelArea())
    .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: lake,
    scale: 100,
    maxPixels: 1e15
    })
    .values()
    .get(0)
  var px_ratio = ee.Number(unmasked_area).divide(lake_area)
  im = im.set('coverage', px_ratio);
  return(im);
};

exports.addDoy = function(img) {
  /* Adds DoY (YYYY-DDD) as property */
  var year = ee.Date(img.get('system:time_start')).get('year').format()
  var doy = ee.Date(img.get('system:time_start')).getRelative('day', 'year').format()
  var yearAndDoy = ee.String(year.cat('-').cat(doy))
  return(img.set({'doy':yearAndDoy}))
}

exports.getMeanRevisitTime = function(featureColl){
  /* Calculate time differences between the acquisitions and get mean/max/min-statistics */
  featureColl = featureColl.sort('system:time_start');
  // get list of all acquisition dates
  var millis = featureColl.aggregate_array('system:time_start');
  // remove last value for second list
  var subtract = millis.slice(0,-1);
  // remove first value for first list
  millis = millis.slice(1);
  // calculate revisit time in milliseconds and convert to days
  var diff_millis = ee.Array(millis).subtract(ee.Array(subtract)).multiply(1.1574e-8);
  var diff_millis_list = diff_millis.toList()//.filter(ee.Filter.gt(name, value))
  // Filter for same 15min acquisition
  diff_millis_list = diff_millis_list.filter(ee.Filter.gt('item', 0.25))
  print('Revisit time list:', diff_millis_list)
  // print out mean, min and max revisit times
  print('Mean revisit time (d):', diff_millis_list.reduce(ee.Reducer.mean()),
        'Max revisit time (d):', diff_millis_list.reduce(ee.Reducer.max()),
        'Min revisit time (d):', diff_millis_list.reduce(ee.Reducer.min()));
};