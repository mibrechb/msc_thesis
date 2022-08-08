// Script to calculate and plot hillshade coverage of a specific lake at the desired ROI

// imports
var s2 = ee.ImageCollection("COPERNICUS/S2_SR"),
    ALOS = ee.Image("JAXA/ALOS/AW3D30/V2_2"),
    jrc = ee.ImageCollection("JRC/GSW1_2/YearlyHistory"),
    roi = /* color: #d63000 */ee.Geometry.Point([8.479329559242847, 46.64559224226865]),
    hydrolakes = ee.FeatureCollection("users/michaelbrechbuehler/hydroLAKES_subset");

// Get lakemask at ROI from JRC-Yearly.
var lakemask = function(point, year){
    var im = jrc
    .filterMetadata('year', 'equals', year)
    .toBands() // convert to image
    .remap([0,1,2,3], [0,1,3,3]); //combine classes seasonal water and permanent water
    // Use reducer to convert raster to vector.
    var mask = im.reduceToVectors({
      geometry: point.buffer(40000),
      geometryType: 'polygon',
      eightConnected: true,
    })
    .filterBounds(point)
    .first();
    var lake = mask.geometry();
    return(lake);
  }
  
var lake = lakemask(roi, 2019)
Map.addLayer(lake, {color:'blue', opacity:0.5}, 'Lake Mask')

// Get imagecollection with desired timespan.
var start = '2019-01-10'
var end = '2020-12-31'
var img_col = s2
  .filterBounds(lake)
  .filterDate(start, end)

print(img_col)

// Function to calculate the shadow coverage of a lake in a given time.
var shadow_coverage = function(img){
  // Adds a shadow band to the image with 0/1 value for non-shadow/shadow.
  var addHillShadow = function(img) { //function to add a layer with the hillshadow
    var elevation=ALOS.clip(img.geometry());
    var crstransform = img.select('B2').projection();
    var azimuth = img.get('MEAN_SOLAR_AZIMUTH_ANGLE');
    var zenith = img.get('MEAN_SOLAR_ZENITH_ANGLE');
    var shadowMap=ee.Terrain.hillShadow(elevation, azimuth, zenith,200,true)
                                            .focal_median(2).reproject(crstransform);
    img = img.addBands(shadowMap); //add band (shadow band) to the original image
    return(img);
  };
  var img_hillshadow = addHillShadow(img)
  var hillshadow = img_hillshadow.select('shadow').int().clip(lake)
  var hillshadow_vector = hillshadow.reduceToVectors({
      geometry: hillshadow.geometry(),
      geometryType: 'polygon',
      eightConnected: true,
    })
    .filterMetadata('label', 'equals', 0)
    .geometry()
  var lake_masked = lake.difference(hillshadow_vector,2)
  var A_tot = lake.area(2)
  var A_covered = hillshadow_vector.area(2)
  var coverage = A_covered.divide(A_tot).multiply(100)
  return(ee.Feature(lake, {coverage:coverage, date:img.get('system:time_start')} ))
}

// Save coverage data for entire collection.
var data = img_col.map(shadow_coverage)
var list_coverage = data.aggregate_array('coverage')
print(list_coverage)
var list_date = data.aggregate_array('date')
print(list_date)

// Define and plot the proportion of covered lake area over time.
var scatterplot = ui.Chart.array
  .values({array: list_coverage, axis: 0, xLabels: list_date})
  .setOptions({
    title: 'Hillshade coverage of lake area over time (S-2)',
    colors: ['cf513e'],
    hAxis: {
      title: 'Date',
      titleTextStyle: {italic: false, bold: true},
    },
    vAxis: {
      title: 'Hillshade coverage [%]',
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

Map.addLayer(roi);
Map.centerObject(roi, 14);
