//var inventory_S1A = ee.FeatureCollection("users/michaelbrechbuehler/inventory_GT_S1_noERA").filterDate();
var inventory_S1 = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/Inventory/inventory_Full_S1_wERA");
var inventory_S2 = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/Inventory/inventory_Full_S2");
var inventory_S3 = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/Inventory/inventory_Full_S3_mergedNotAll");
var inventory_L7 = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/Inventory/inventory_Full_L7");
var inventory_L8 = ee.FeatureCollection("users/michaelbrechbuehler/msc_thesis/Inventory/inventory_Full_L8");
var inventory_merged = ee.FeatureCollection("users/michaelbrechbuehler/inventory_Full_merge_correlation_merged");

var hydroLAKES = ee.FeatureCollection("users/michaelbrechbuehler/hydroLAKES_subset_wJRC");
var hydroLAKES_FEATUREVIEW = ui.Map.FeatureViewLayer("users/michaelbrechbuehler/hydroLAKES_subset_wJRC_FEATUREVIEW");
var alpenkonvention = ee.FeatureCollection("users/michaelbrechbuehler/Alpenkonvention");
var alpenkonvention_FEATUREVIEW = ui.Map.FeatureViewLayer("users/michaelbrechbuehler/Alpenkonvention_FEATUREVIEW");
var jrc = ee.ImageCollection("JRC/GSW1_3/YearlyHistory")


// *************************************************//
// LIP Extraction Functions
// *************************************************//

// Extract LIP
var extractLIP = function(featureColl){
  // set booleans for LIP events
  var unfrozen = false
  var FUS = false
  var FUSdate = 0
  var FUE = false
  var FUEdate = 0
  var BUS = false
  var BUSdate = 0
  var BUE = false
  var BUEdate = 0
  var LIPs = ee.List([])
  // fetch proportion and dates from server
  featureColl = featureColl.sort('system:time_start')
  var props = featureColl.aggregate_array('proportion').getInfo()
  var dates = featureColl.aggregate_array('system:time_start').getInfo()
  // loop over lake coverage list and search for LIP events
  for (var i = 0; i < props.length; i++) {
    if (unfrozen === false){
      if (props[i] < 30) {
        unfrozen = true;
      }
    } else if (FUS === false){
      if (props[i] >= 30) {
        if (props[i-1] < 30){
          FUS = true;
          FUSdate = dates[i];
          i = i-1;
        }
      }
    } else if (FUE === false){
      if (props[i] >= 70) {
        if (props[i-1] < 70){
          FUE = true;
          FUEdate = dates[i];
          i = i-1;
        }
      }
      else if(props[i] < 30) {
        FUS = false;
      }
    } else if (BUS === false){
      if (props[i] <= 70) {
        if (props[i-1] > 70){
          BUS = true;
          BUSdate = dates[i];
          i = i-1;
        }
      }
    } else if (BUE === false){
      if (props[i] <= 30) {
        if (props[i-1] > 30){
          BUE = true;
          BUEdate = dates[i];
          i = i-1;
        }
      }
      else if(props[i] > 70) {
        BUS = false;
      }
    } else if (FUS === true || FUE === true || BUS === true || BUE === true){
      // Create a feature with LIP events for one cycle
      var LIP = ee.Feature(null, {
      'system:index': ee.Date(FUSdate).format('YYYY-MM-dd').cat('_').cat(ee.Date(BUEdate).format('YYYY-MM-dd')),
      'FUS': ee.Date(FUSdate),
      'FUE': ee.Date(FUEdate),
      'BUS': ee.Date(BUSdate),
      'BUE': ee.Date(BUEdate),
      'ICD': ee.Date(BUEdate).difference(ee.Date(FUSdate), 'day'),
      'CFD': ee.Date(BUSdate).difference(ee.Date(FUEdate), 'day')
      });
      // Add feature to list
      LIPs = LIPs.add(LIP);
      // Print-out LIP events
      /*
      print('Freeze-Up Start (FUS)', ee.Date(FUSdate).format('YYYY-MM-dd'), 
            'Freeze-Up End (FUE)', ee.Date(FUEdate).format('YYYY-MM-dd'), 
            'Break-Up Start (BUS)', ee.Date(BUSdate).format('YYYY-MM-dd'),
            'Break-Up End (BUE)', ee.Date(BUEdate).format('YYYY-MM-dd'),
            'Ice Coverage Duration (ICD)', ee.Date(BUEdate).difference(ee.Date(FUSdate), 'day'),
            'Complete Freeze Duration (CFD)', ee.Date(BUSdate).difference(ee.Date(FUEdate), 'day'))
            */
      // Reset LIP booleans
      FUS = false;
      FUE = false;
      BUS = false;
      BUE = false;
    }
  }
    return(ee.FeatureCollection(LIPs));
}

// *************************************************//
// Data Filtering Functions
// *************************************************//
// Start- and enddate, can be selected in infopanel
var datapoints_startYear = '2019'
var datapoints_startMonth = '08'
var datapoints_endYear = '2020'
var datapoints_endMonth = '08'

// Generates a new time series chart for the given coordinates.
var getDatapoints = function () {
  var targetLakes = hydroLAKES.filterBounds(ee.Geometry.Point(target))
  // Define timerange from selectors
  var startDate = ee.String(datapoints_startYear).cat('-').cat(datapoints_startMonth).cat('-01')
  startDate = ee.Date(startDate)
  var endDate = ee.String(datapoints_endYear).cat('-').cat(datapoints_endMonth).cat('-01')
  endDate = ee.Date(endDate)
  // Workaround if invalid input timerange is given. Switch order or add 1 month.
  var difference = endDate.difference(startDate, 'month')
  var reversedInput = difference.lt(0)
  var noDifference = difference.eq(0)
  var tempDate = startDate
  startDate = ee.Algorithms.If(reversedInput, endDate, startDate)
  endDate = ee.Algorithms.If(reversedInput, tempDate, endDate)
  endDate = ee.Algorithms.If(noDifference, ee.Date(endDate).advance(1, 'month'), ee.Date(endDate))
  // Get datapoints
  if (targetLakes.size().getInfo() !== 0){
    var Hylak_id = targetLakes.first().get('Hylak_id')
    var s1 = inventory_S1.filterMetadata('Hylak_id', 'equals', Hylak_id)
    var s2 = inventory_S2.filterMetadata('Hylak_id', 'equals', Hylak_id)
    var s3 = inventory_S3.filterMetadata('Hylak_id', 'equals', Hylak_id)
    var l7 = inventory_L7.filterMetadata('Hylak_id', 'equals', Hylak_id)
    var l8 = inventory_L8.filterMetadata('Hylak_id', 'equals', Hylak_id)
    var datapoints = s2.merge(l8).merge(l7).merge(s1).merge(s3)
    datapoints = datapoints.filterDate(startDate, endDate)
    var fit = inventory_merged.filterMetadata('Hylak_id', 'equals', Hylak_id).filterDate(startDate, endDate)
    //Datapoints without active filtering
    return(datapoints.merge(fit))
    //Datapoints with active filtering
    //return(movingWindow(datapoints, 30).merge(datapoints))
  }
  else{
    return(null)
  }
};

// *************************************************//
// Visualization Parameters
// *************************************************//

// Get min- and max-value for percent stretch

var getPercentStretch = function(im, sampling_geom, percent) {
  var lower_percentile = ee.Number(100).subtract(percent).divide(2);
  var upper_percentile = ee.Number(100).subtract(lower_percentile);
  var stats = im.reduceRegion({
    reducer: ee.Reducer.percentile({percentiles: [lower_percentile, upper_percentile]}).setOutputs(['lower', 'upper']),
    geometry: sampling_geom,
    scale: 100, 
    bestEffort: true
  });
  var vis_params = ee.Dictionary({
      'min': [ee.Number(stats.get('R_lower')), ee.Number(stats.get('G_lower')), ee.Number(stats.get('B_lower'))],
      'max': [ee.Number(stats.get('R_upper')), ee.Number(stats.get('G_upper')), ee.Number(stats.get('B_upper'))]
  });
  return(vis_params)
};

// Get min- and max-value for standard deviation stretch
var getStdDevStretch = function(im, sampling_geom, num_stddev) {
  var stats = im.reduceRegion({
    reducer: ee.Reducer.mean().combine({reducer2:ee.Reducer.stdDev(), sharedInputs:true})
                              .setOutputs(['mean', 'stddev']), 
    geometry: sampling_geom,
    scale: 100, 
    bestEffort: true
  });
  var vis_params = ee.Dictionary({
      'min': [ee.Number(stats.get('R_mean'))
               .subtract(ee.Number(num_stddev).multiply(ee.Number(stats.get('R_stddev')))),
              ee.Number(stats.get('G_mean'))
               .subtract(ee.Number(num_stddev).multiply(ee.Number(stats.get('G_stddev')))),
              ee.Number(stats.get('B_mean'))
               .subtract(ee.Number(num_stddev).multiply(ee.Number(stats.get('B_stddev'))))],
      'max': [ee.Number(stats.get('R_mean'))
               .add(ee.Number(num_stddev).multiply(ee.Number(stats.get('R_stddev')))),
              ee.Number(stats.get('G_mean'))
               .add(ee.Number(num_stddev).multiply(ee.Number(stats.get('G_stddev')))),
              ee.Number(stats.get('B_mean'))
               .add(ee.Number(num_stddev).multiply(ee.Number(stats.get('B_stddev'))))]
  });
  return(vis_params);
};

// Constants used to visualize the data on the map.
var HIGHLIGHT_STYLE = {color: 'E67300', fillColor: 'FF9900'};

// Text style for footnotes and references
var LEGEND_FOOTNOTE_STYLE = {
  width: '220px',
  fontSize: '10px',
  stretch: 'horizontal',
  textAlign: 'left',
  margin: '0px 18px 0px',
};

var CHART_FOOTNOTE_STYLE = {
  //width: '400px',
  fontSize: '10px',
  stretch: 'horizontal',
  textAlign: 'center',
  margin: '0px 110px 0px',
};

//var baseChange = [{featureType: 'water', elementType: 'labels.text', stylers: [{invert_lightness: true}]}];
var mapStyle = require('users/michaelbrechbuehler/msc_thesis:Mapstyle')
//print(mapStyle)

var mapPanel = ui.Map();
mapPanel.setOptions('mapStyle', {mapStyle: mapStyle.mapstyle});

// *************************************************//
// GUI
// *************************************************//

// Configure our map with a minimal set of controls.
mapPanel.setControlVisibility(false);
mapPanel.setControlVisibility({scaleControl: true, zoomControl: true});
mapPanel.style().set({cursor: 'crosshair'});

// Add Mapping Layers
mapPanel.centerObject(alpenkonvention, 8);

// Add lakes and study are as ee.FeatureCollections objects
//mapPanel.addLayer(alpenkonvention, {color: 'FF0000'}, 'Alpenkonvention', true, 0.1)
//mapPanel.addLayer(hydroLAKES, {color: '#0aa1ff'}, 'HydroLAKES', true, 0.5);

// Add lakes and study are as ee.FeatureView objects
// Set styling for hydroLAKES_FEATUREVIEW
hydroLAKES_FEATUREVIEW.setVisParams({
  color: 'black',
  fillColor: '#0aa1ff',
  width: 1.0,
});
mapPanel.add(hydroLAKES_FEATUREVIEW, {color: '#0aa1ff'}, 'HydroLAKES', true, 0.5);

// Set visualization properties for the defined layer.
alpenkonvention_FEATUREVIEW.setVisParams({
  color: 'red',
  fillColor: 'red',
  width: 2.0,
  fillOpacity: 0.0
});

mapPanel.add(alpenkonvention_FEATUREVIEW, {color: '#0aa1ff'}, 'HydroLAKES', true, 0.5);

/*
// Create the application title bar.
mapPanel.add(ui.Label(
    'Lake Ice Phenology - Inspector', {fontWeight: 'bold', fontSize: '24px'}));
*/

var target = [];

// Returns the list of countries the user has selected.
function getSelectedLake() {
  return hydroLAKES.filterBounds(ee.Geometry.Point(target));
} 

function updateThumbnail(timestamp, proportion, series){
  if(proportion === null){
    // Work-around if datapoint is deselcted or series is clicked
    //print('Info: No data to update thumbnail');
  }
  else{
    //thumbnailStyle.set({shown: false})
    var im = ee.Image();
    var id = ee.String('');
    var params = {};
    var fetch = {};
    var min = [];
    var max = [];
    var p5 = [];
    var p95 = [];
    var minMax = {};
    var percentile = {};
    var hylak = getSelectedLake();
    var lakePolygon = hylak.geometry();
    var lakeBuffer = lakePolygon.buffer(1000, 10);
    var lakeBigBuffer = lakePolygon.buffer(5000, 100)
    if (series == 'L7'){
      im = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2").filterMetadata('system:time_start', 'equals', timestamp).first().select(['SR_B3', 'SR_B2', 'SR_B1'], ['R', 'G', 'B']);
      id = im.id();
    } else if (series == 'L8'){
      im = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").filterMetadata('system:time_start', 'equals', timestamp).first().select(['SR_B4', 'SR_B3', 'SR_B2'], ['R', 'G', 'B']);
      id = im.id();
    } else if (series == 'S1'){
      im = ee.ImageCollection("COPERNICUS/S1_GRD").filterMetadata('system:time_start', 'equals', timestamp).first().select(['VV', 'VV', 'VV'], ['R', 'G', 'B']);
      id = im.id();
    } else if (series == 'S2'){
      im = ee.ImageCollection("COPERNICUS/S2_SR").filterMetadata('system:time_start', 'equals', timestamp).first().select(['B4', 'B3', 'B2'], ['R', 'G', 'B']);
      id = im.id();
    } else if (series == 'S3'){
      im = ee.ImageCollection("COPERNICUS/S3/OLCI").filterMetadata('system:time_start', 'equals', timestamp).first().select(['Oa08_radiance', 'Oa06_radiance', 'Oa04_radiance'], ['R', 'G', 'B']);
      id = im.id();
    }
    params = getStdDevStretch(im, lakeBigBuffer, 2)
    // Set the thumbnail image and information with evaluate
    thumbnail.setParams({region: lakeBuffer});
    var lakePolygonImage = ee.Image(hylak.style({fillColor: "#00000000", color: "red" }));
    params.evaluate(function(params){
      thumbnail.setImage(im.visualize(params).blend(lakePolygonImage));
      thumbnailPanelStyle.set({shown: true});
    })
    ee.Date(im.get('system:time_start')).format('yyyy-MM-dd HH:mm:ss').evaluate(function(timestamp){
      timestampValue.setValue(timestamp);
    });
    ee.Number(proportion).format('%.2f').evaluate(function(proportion){
      proportionValue.setValue(proportion + '%');
    });
    im.id().evaluate(function(id){
      imIDValue.setValue(id);
    });
  }
}

// Function to add dummy datapoints in the right chronological order
function addDummies(featureColl){
  featureColl = featureColl.sort('system:time_start')
  var t_first = ee.Date(featureColl.first().get('system:time_start'))
  var names = ee.List(['L7', 'L8', 'S1', 'S2', 'S3', 'fit'])
  var dummies = names.map(function(sensorname){
    var step = names.indexOf(sensorname).subtract(6)
    return(ee.Feature(null, {proportion: null, sensor: sensorname, 'system:time_start': t_first.advance(step, 'second').millis()}))
  })
  return(featureColl.merge(dummies).sort('system:time_start'))
}

// Makes a bar chart of the given FeatureCollection of countries by name.
function makeResultsChart() {
  doyViewCheckBox.setDisabled(false)
  doyViewCheckBox.style().set('color', 'black')
  // Control if "DoY-View" checkbox is checked and create chart accordingly
  if (doyViewCheckBox.getValue() === false){
    // Create time-series chart
    var data = addDummies(getDatapoints())
    var chart = ui.Chart.feature
          .groups({
            features: data,
            xProperty: 'system:time_start',
            yProperty: 'proportion',
            seriesProperty: 'sensor'
          })
    .setChartType('ComboChart')
    .setOptions({
      seriesType: 'scatter',
      title: 'Proportion of ice covered lake area over time',
      //colors: ['cf513e'],
      hAxis: {
        title: 'Date',
        titleTextStyle: {italic: false, bold: true},
        gridlines: {count: 12}
      },
      vAxis: {
        title: 'Lake coverage [%]',
        titleTextStyle: {italic: false, bold: true},
        minValue: 0,
        maxValue: 100,
      },
      interpolateNulls: true,
      series :{
        0:{
          pointSize: 2,
          lineSize: 0,
          //dataOpacity: 0.4,
          color: '#3366CC'
        },
        1:{
          pointSize: 2,
          lineSize: 0,
          //dataOpacity: 0.4,
          color: '#22AA99'
        },
        2:{
          pointSize: 2,
          lineSize: 0,
          //dataOpacity: 0.4,
          color: '#DC3912'
        },
        3:{
          pointSize: 2,
          lineSize: 0,
          //dataOpacity: 0.4,
          color: '#FF9900'
        },  
        4:{
          pointSize: 2,
          lineSize: 0,
          //dataOpacity: 0.4,
          color: '#990099'
        },   
        5:{
          enableInteractivity: false,
          tooltip: 'none',
          type: 'area',
          pointSize: 0,
          lineSize: 2,
          dataOpacity: 0.4,
          color: '#0aa1ff'
        }
      }
      //legend: {position: 'none'
      });
      chart.onClick(updateThumbnail);
      return(chart);
  } else {
    // Create DoY-chart
    var data = addDummies(getDatapoints()).map(function(datapoint){
    var tempDate = ee.Date(datapoint.get('system:time_start'));
    var tempDoY = ee.Number(tempDate.getRelative('day', 'year').int());
    var tempYear = ee.Number(tempDate.get('year')).int();
    return(datapoint.set('doy', tempDoY).set('year', tempYear));
  });
  var chart = ui.Chart.feature
        .groups({
          features: data,
          xProperty: 'doy',
          yProperty: 'proportion',
          seriesProperty: 'year'
        })
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Proportion of ice covered lake area over years',
    //colors: ['cf513e'],
    hAxis: {
      title: 'Day of year',
      titleTextStyle: {italic: false, bold: true},
      viewWindow: {min:0, max:365},
      gridlines: {count: 12}
    },
    vAxis: {
      title: 'Lake coverage [%]',
      titleTextStyle: {italic: false, bold: true},
      minValue: 0,
      maxValue: 100,
    },
    pointSize: 0,
    lineSize: 2,
    dataOpacity: 0.4,
    interpolateNulls: true
    //legend: {position: 'none'
    });
    chart.onClick(updateThumbnail);
    return(chart);
  }

}

// Show LIP table
function makeResultsTable() {
  doyViewCheckBox.setDisabled(true)
  doyViewCheckBox.style().set('color', 'grey')
  doyViewCheckBox.setValue(false)
  var data = getDatapoints().filterMetadata('sensor', 'equals', 'fit');
  var LIPs = extractLIP(data);
  //print(LIPs);
  if (ee.FeatureCollection(LIPs).size().neq(0).getInfo()){
    var table = ui.Chart.feature.byFeature(LIPs, 'FUS', ['FUE', 'BUS', 'BUE', 'ICD', 'CFD'])
    table.setChartType('Table')
    table.setOptions({allowHtml: true, pageSize: 5, showRowNumber: true})
    table.style().set({stretch: 'both'})
  } else {
    var table = ui.Label('No LIP events found for selected lake and time-range!', 
      {color:'red',stretch:'horizontal', textAlign:'center', height:'100px'})
  }
  /*
  // Implementation with server-side algorithm.if
  // Doesnt work, cannot set style. TODO: Find workaround!
  var table = ee.Algorithms.If({
    condition: ee.FeatureCollection(LIPs).size().neq(0), 
    trueCase: ui.Chart.feature.byFeature(LIPs, 'FUS', ['FUE', 'BUS', 'BUE', 'ICD', 'CFD'])
      .setChartType('Table')
      .setOptions({allowHtml: true, pageSize: 5, showRowNumber: true})
      .style().set({stretch: 'both'}), 
    falseCase: ui.Label('No LIP events found for selected lake and time-range!')
  })
  */
  return table;
}

// Updates the map overlay using the currently-selected lake.
function updateOverlay() {
  var overlay = getSelectedLake().style(HIGHLIGHT_STYLE);
  updateHylakInfo(getSelectedLake());
  thumbnailPanelStyle.set({shown: false});
  mapPanel.layers().set(2, ui.Map.Layer(overlay, [], 'Target'));
}

// Updates the chart using the currently-selected charting function,
function updateChart() {
  if(selector_startYear.getDisabled){
    selector_startYear.setDisabled(false);
    selector_startYear.style().set({color: 'grey'});
    selector_startMonth.setDisabled(false);
    selector_startMonth.style().set({color: 'grey'});
    selector_endYear.setDisabled(false);
    selector_endYear.style().set({color: 'grey'});
    selector_endMonth.setDisabled(false);
    selector_endMonth.style().set({color: 'grey'});

  }
  var chartBuilder = chartTypeToggleButton.value;
  var chart = chartBuilder(getSelectedLake());
  var note = ui.Label('↑ click lake ice datapoint to load the corresponding Landsat scene to map (experimental feature)',  CHART_FOOTNOTE_STYLE);
  resultsPanel.clear().add(chart).add(note).add(buttonPanel);
}

// Clears the set of selected points and resets the overlay and results
// panel to their default state.
function clearResults() {
  target = [];
  mapPanel.layers().remove(mapPanel.layers().get(2));
  var instructionsLabel = ui.Label('Select lake for LIP extraction.');
  resultsPanel.widgets().reset([instructionsLabel]);
}

// Register a click handler for the map that adds the clicked point to the
// list and updates the map overlay and chart accordingly.
function handleMapClick(location) {
  target = ([location.lon, location.lat]);
  var point = ee.Geometry.Point(target);
  if(hydroLAKES.filterBounds(point).size().getInfo() === 0){
    //print('No lake found!')
  } else{
    updateOverlay();
    updateChart();
    //updateInfo();
  }
}

mapPanel.onClick(handleMapClick);

// A button widget that toggles (or cycles) between states.
// To construct a ToggleButton, supply an array of objects describing
// the desired states, each with 'label' and 'value' properties.
function ToggleButton(states, onClick) {
  var index = 0;
  var button = ui.Button(states[index].label);
  button.value = states[index].value;
  button.onClick(function() {
    index = ++index % states.length;
    button.setLabel(states[index].label);
    button.value = states[index].value;
    onClick();
  });
  return button;
}

var doyViewCheckBox = ui.Checkbox({
  label: 'DOY-View', 
  value: false, 
  onChange: updateChart, 
  disabled: false,
  style: {stretch: 'vertical'}
});

// Our chart type toggle button: the button text is the opposite of the
// current state, since you click the button to switch states.
var chartTypeToggleButton = ToggleButton(
    [
      {
        label: 'Display Lake ice phenology',
        value: makeResultsChart,
      },
      {
        label: 'Display Lake ice coverage',
        value: makeResultsTable,
      }
    ],
    updateChart);

/*
 * Info Panel setup
 */

// *_*_*_*_*_*_*_*_* Date Selection
var years = ['2016', '2017', '2018', '2019', '2020', '2021'];
var months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

var label_startDateSelector = ui.Label('Start date:', {width: '65px', stretch: 'vertical', fontSize: '16', color: 'grey'})

var selector_startYear = ui.Select({
  items: years,
  value: '2019',
  style: {color: '#e2e2e2'},
  disabled: true,
  onChange: function(year) {
    datapoints_startYear = year
    updateChart();
  }
});

var selector_startMonth = ui.Select({
  items: months,
  value: '08',
  style: {color: '#e2e2e2'},
  disabled: true,
  onChange: function(month) {
    datapoints_startMonth = month
    updateChart();
  }
});

var startSelectorPanel = ui.Panel(
    [label_startDateSelector, selector_startYear, selector_startMonth],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth'});

var label_endDateSelector = ui.Label('End date:', {width: '65px', stretch: 'vertical', fontSize: '16', color: 'grey'})

var selector_endYear = ui.Select({
  items: years,
  value: '2020',
  style: {color: '#e2e2e2'},
  disabled: true,
  onChange: function(year) {
    datapoints_endYear = year
    updateChart();
  }
});

var selector_endMonth = ui.Select({
  items: months,
  value: '08',
  style: {color: '#e2e2e2'},
  disabled: true,
  onChange: function(month) {
    datapoints_endMonth = month
    updateChart();
  }
});


var endSelectorPanel = ui.Panel(
    [label_endDateSelector, selector_endYear, selector_endMonth],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: 'grey'});

var title_dateSelection = ui.Label('Date selection', {margin: '15px 18px 8px', fontWeight: 'bold', fontSize: '16', color: 'grey'})
var dateSelectionPanel = ui.Panel({style: {}}).add(title_dateSelection).add(startSelectorPanel).add(endSelectorPanel)

// *_*_*_*_*_*_*_*_* HydroLAKES panel

var width_title = '150px'

var lakeIDTitle = ui.Label('HydroLAKES ID:', {width: width_title, stretch: 'vertical', fontSize: '16', color: 'grey'})
var lakeIDValue = ui.Label('..', {width: '120px', stretch: 'vertical', fontSize: '16', color: 'grey'})
var hylakInfoPanel_lakeID = ui.Panel(
    [lakeIDTitle, lakeIDValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: '0aa1ff'});

var elevationTitle = ui.Label('Elevation (m.a.s.l.):', {width: width_title, stretch: 'vertical', fontSize: '16', color: 'grey'})
var elevationValue = ui.Label('..', {width: '120px', stretch: 'vertical', fontSize: '16', color: 'grey'})
var hylakInfoPanel_elevation = ui.Panel(
    [elevationTitle, elevationValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: '0aa1ff'});

var lakeTypeTitle = ui.Label('Lake type:', {width: width_title, stretch: 'vertical', fontSize: '16', color: 'grey'})
var lakeTypeValue = ui.Label('..', {width: '120px', stretch: 'vertical', fontSize: '16', color: 'grey'})
var hylakInfoPanel_lakeType = ui.Panel(
    [lakeTypeTitle, lakeTypeValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: '0aa1ff'});
    
var lakeAreaTitle = ui.Label('Lake area (km²):', {width: width_title, stretch: 'vertical', fontSize: '16', color: 'grey'})
var lakeAreaValue = ui.Label('..', {width: '120px', stretch: 'vertical', fontSize: '16', color: 'grey'})
var hylakInfoPanel_lakeArea = ui.Panel(
    [lakeAreaTitle, lakeAreaValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: '0aa1ff'});
    
var shLenTitle = ui.Label('Shore length (km):', {width: width_title, stretch: 'vertical', fontSize: '16', color: 'grey'})
var shLenValue = ui.Label('..', {width: '120px', stretch: 'vertical', fontSize: '16', color: 'grey'})
var hylakInfoPanel_shLen = ui.Panel(
    [shLenTitle, shLenValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: '0aa1ff'});
    
var volumeTitle = ui.Label('Lake volume (mcm):', {width: width_title, stretch: 'vertical', fontSize: '16', color: 'grey'})
var volumeValue = ui.Label('..', {width: '120px', stretch: 'vertical', fontSize: '16', color: 'grey'})
var hylakInfoPanel_volume = ui.Panel(
    [volumeTitle, volumeValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: '0aa1ff'});

var depthTitle = ui.Label('Avg. depth (m):', {width: width_title, stretch: 'vertical', fontSize: '16', color: 'grey'})
var depthValue = ui.Label('..', {width: '120px', stretch: 'vertical', fontSize: '16', color: 'grey'})
var hylakInfoPanel_depth = ui.Panel(
    [depthTitle, depthValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 10px 0px', width: 'maxWidth', color: '0aa1ff'});

var hylakReferenceText = ui.Label('Lake parameters provided are extracted from the HydroLAKES Version 1.0 global lakes dataset.',
  LEGEND_FOOTNOTE_STYLE)
var hylakReferenceLink = ui.Label('(Messager et. al, 2016)',
  LEGEND_FOOTNOTE_STYLE).setUrl('http://dx.doi.org/10.1038/ncomms13603')

var updateHylakInfo = function(selectedLakes) {
  var lake = selectedLakes.first()
  var propertyDict = lake.toDictionary().evaluate(function(dict){
    lakeIDValue.setValue(dict.Hylak_id)
    elevationValue.setValue(dict.Elevation)
    if (dict.Lake_type == 1){
      lakeTypeValue.setValue(dict.Lake_type + ' (Natural lake)')
    } else if (dict.Lake_type == 2){
      lakeTypeValue.setValue(dict.Lake_type + ' (Reservoir)')
    } else {
      lakeTypeValue.setValue(dict.Lake_type + ' (Lake control)')
    }
    lakeAreaValue.setValue(dict.Lake_area)
    shLenValue.setValue(dict.Shore_len)
    volumeValue.setValue(dict.Vol_total)
    depthValue.setValue(dict.Depth_avg)
  })
}

var title_hylakInfo = ui.Label('Lake information', {margin: '15px 18px 8px', fontWeight: 'bold', fontSize: '16', color: 'grey'})
var hylakPanel = ui.Panel({style: {}})
  .add(title_hylakInfo)
  .add(hylakInfoPanel_lakeID).add(hylakInfoPanel_elevation)
  .add(hylakInfoPanel_lakeType).add(hylakInfoPanel_lakeArea).add(hylakInfoPanel_shLen).add(hylakInfoPanel_volume).add(hylakInfoPanel_depth)
  .add(hylakReferenceText).add(hylakReferenceLink)

// *_*_*_*_*_*_*_*_* Inspector panel

// Create a panel to hold title, intro text, chart and legend components.
var inspectorPanel = ui.Panel({style: {width: '20%', color:'grey'}});

// Add a title and some explanatory text to a side panel.
var header = ui.Label('Lake ice monitoring in the European Alps', {fontWeight: 'bold', fontSize: '36px', color: '#129BC4'});
var text_instructions = ui.Label(
  'Inspect lake ice phenology statistics of lakes in the European Alps. \
  First, select the desired lake with your cursor and then change the start \
  and end date for the desired observation period with the selectors below.',
  {fontSize: '16px'})
var text_info = ui.Label(
  'This GEE app is based on the MSc thesis "Multi-sensor lake ice monitoring \
  in the European Alps using the Google Earth Engine" by Michael Brechbühler \
  of the Departement of Geography at the University of Zurich. \
  For more information please visit: ',
  {fontSize: '16px'})
var link = ui.Label('licmonitoring.com', {fontSize: '20px'}).setUrl('http://licmonitoring.com')

inspectorPanel.add(header).add(text_instructions).add(text_info).add(link).add(dateSelectionPanel).add(hylakPanel);

// Create panels to hold lon/lat values.
var lon = ui.Label();
var lat = ui.Label();
inspectorPanel.add(ui.Panel([lon, lat], ui.Panel.Layout.flow('horizontal')));

/*
 * Chart Panel setup
 */

// A panel containing the two buttons .
var buttonPanel = ui.Panel(
    [ui.Button('Clear results', clearResults), chartTypeToggleButton, doyViewCheckBox],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0 0 0 auto', width: '800px'});

/*
 * Thumbnail
 */
 
var thumbnail = ui.Thumbnail({
    //style: {position: 'top-right', shown: false}
  }).setImage(ee.Image())

var thumbnailStyle = thumbnail.style();

var thumbnail_title = ui.Label('Image thumbnail', {fontWeight: 'bold', fontSize: '16', color: 'grey'})
var width_tn = 100

var imIDTitle = ui.Label('Image ID:', {width: width_tn, stretch: 'vertical', fontWeight: 'bold', fontSize: '16', color: 'grey'})
var imIDValue = ui.Label('..', {width: '130px', fontSize: '16', color: 'grey'})
var thumbnail_imID = ui.Panel(
    [imIDTitle, imIDValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 0px 0px', width: 'maxWidth', color: '0aa1ff'});

var timestampTitle = ui.Label('Time:', {width: width_tn, stretch: 'vertical', fontWeight: 'bold', fontSize: '16', color: 'grey'})
var timestampValue = ui.Label('..', {width: '130px', fontSize: '16', color: 'grey'})
var thumbnail_timestamp = ui.Panel(
    [timestampTitle, timestampValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 0px 0px', width: 'maxWidth', color: '0aa1ff'});

var proportionTitle = ui.Label('Ice coverage:', {width: width_tn, stretch: 'vertical', fontWeight: 'bold', fontSize: '16', color: 'grey'})
var proportionValue = ui.Label('..', {width: '130px', fontSize: '16', color: 'grey'})
var thumbnail_proportion = ui.Panel(
    [proportionTitle, proportionValue],
    ui.Panel.Layout.Flow('horizontal'), {margin: '0px 0px 0px', width: 'maxWidth', color: '0aa1ff'});

var thumbnailPanel = ui.Panel({
    style: {position: 'top-right', shown: false}
  }).add(thumbnail_title).add(thumbnail).add(thumbnail_imID).add(thumbnail_timestamp).add(thumbnail_proportion)

var thumbnailPanelStyle = thumbnailPanel.style();

/*
 * Build App
 */
 
// Replace the root with a SplitPanel that contains the inspector and map.
var splitPanel = ui.SplitPanel(inspectorPanel, mapPanel)
ui.root.clear();
ui.root.add(inspectorPanel);
ui.root.add(mapPanel)

var resultsPanel = ui.Panel({style: {position: 'bottom-right'}});
var hylakPanel = ui.Panel({style: {position: 'bottom-right'}});
var betaLabel = ui.Label('This application is currently in beta state. For questions or encountered \
  technical difficulties please contact: michael.brechbuehler@uzh.ch', {color: 'red', position: 'top-center', fontWeight: 'bold', width: '25%'})
mapPanel.add(resultsPanel);
mapPanel.add(thumbnailPanel)
mapPanel.add(betaLabel)
clearResults();