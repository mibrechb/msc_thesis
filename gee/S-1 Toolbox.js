var genTools = require('users/michaelbrechbuehler/msc_thesis:General Toolbox')

//---------------------------------------------------------------------------//
// Linear to db scale 
//---------------------------------------------------------------------------//
  
/** Convert backscatter from linear to dB. */
exports.lin_to_db = function(image) {
  var bandNames = ['VV', 'VH']//image.bandNames().remove('angle');
  var db = ee.Image.constant(10).multiply(image.select(bandNames).log10()).rename(bandNames)
  return image.addBands(db, null, true)
};

/** Convert backscatter from linear to dB. */
exports.db_to_lin = function(image) {
  var bandNames = ['VV', 'VH']//image.bandNames().remove('angle');
  var lin = ee.Image.constant(10).pow(image.select(bandNames).divide(10)).rename(bandNames)
  return image.addBands(lin, null, true)
};

//---------------------------------------------------------------------------//
// Filters
//---------------------------------------------------------------------------//

// Boxcar filter
exports.boxcar = function(image) {
  /** Applies boxcar filter on every image in the collection. */
  var KERNEL_SIZE = 5;
  var bandNames = image.bandNames().remove('angle');
  // Define a boxcar kernel
  var kernel = ee.Kernel.square({radius: (KERNEL_SIZE/2), units: 'pixels', normalize: true});
  // Apply boxcar
  var output = image.select(bandNames).convolve(kernel).rename(bandNames);
  return image.addBands(output, null, true)
};

// Lee filter 
var leefilter = function(image) {
    /** Lee Filter applied to one image. It is implemented as described in 
     J. S. Lee, “Digital image enhancement and noise filtering by use of local statistics,” 
     IEEE Pattern Anal. Machine Intell., vol. PAMI-2, pp. 165–168, Mar. 1980.*/
    var KERNEL_SIZE = 5;
    var bandNames = ['VV', 'VH']//image.bandNames().remove('angle');
    //S1-GRD images are multilooked 5 times in range
    var enl = 5
    // Compute the speckle standard deviation
    var eta = 1.0/Math.sqrt(enl); 
    eta = ee.Image.constant(eta);

    // MMSE estimator
    // Neighbourhood mean and variance
    var oneImg = ee.Image.constant(1);

    var reducers = ee.Reducer.mean().combine({
                  reducer2: ee.Reducer.variance(),
                  sharedInputs: true
                  });
    var stats = image.select(bandNames).reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(KERNEL_SIZE/2,'pixels'), optimization: 'window'})
    var meanBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_mean')});
    var varBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_variance')});
    
    var z_bar = stats.select(meanBand);
    var varz = stats.select(varBand);

    // Estimate weight 
    var varx = (varz.subtract(z_bar.pow(2).multiply(eta.pow(2)))).divide(oneImg.add(eta.pow(2)));
    var b = varx.divide(varz);

    //if b is negative set it to zero
    var new_b = b.where(b.lt(0), 0)
    var output = oneImg.subtract(new_b).multiply(z_bar.abs()).add(new_b.multiply(image.select(bandNames)));
    output = output.rename(bandNames);
    return image.addBands(output, null, true);
  }   

// Refined Lee filter 
exports.refinedLee = function(image) {
/** This filter is modified from the implementation by Guido Lemoine 
 * Source: Lemoine et al.; https://code.earthengine.google.com/5d1ed0a0f0417f098fdfd2fa137c3d0c */
    var bandNames = ['VV', 'VH'] //image.bandNames().remove('angle');//image.bandNames().remove('angle');
  
    var result = ee.ImageCollection(bandNames.map(function(b){
    var img = image.select([b]);
    
    // img must be linear, i.e. not in dB!
    // Set up 3x3 kernels 
    var weights3 = ee.List.repeat(ee.List.repeat(1,3),3);
    var kernel3 = ee.Kernel.fixed(3,3, weights3, 1, 1, false);
  
    var mean3 = img.reduceNeighborhood(ee.Reducer.mean(), kernel3);
    var variance3 = img.reduceNeighborhood(ee.Reducer.variance(), kernel3);
  
    // Use a sample of the 3x3 windows inside a 7x7 windows to determine gradients and directions
    var sample_weights = ee.List([[0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0], [0,1,0,1,0,1,0], [0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0]]);
  
    var sample_kernel = ee.Kernel.fixed(7,7, sample_weights, 3,3, false);
  
    // Calculate mean and variance for the sampled windows and store as 9 bands
    var sample_mean = mean3.neighborhoodToBands(sample_kernel); 
    var sample_var = variance3.neighborhoodToBands(sample_kernel);
  
    // Determine the 4 gradients for the sampled windows
    var gradients = sample_mean.select(1).subtract(sample_mean.select(7)).abs();
    gradients = gradients.addBands(sample_mean.select(6).subtract(sample_mean.select(2)).abs());
    gradients = gradients.addBands(sample_mean.select(3).subtract(sample_mean.select(5)).abs());
    gradients = gradients.addBands(sample_mean.select(0).subtract(sample_mean.select(8)).abs());
  
    // And find the maximum gradient amongst gradient bands
    var max_gradient = gradients.reduce(ee.Reducer.max());
  
    // Create a mask for band pixels that are the maximum gradient
    var gradmask = gradients.eq(max_gradient);
  
    // duplicate gradmask bands: each gradient represents 2 directions
    gradmask = gradmask.addBands(gradmask);
  
    // Determine the 8 directions
    var directions = sample_mean.select(1).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(7))).multiply(1);
    directions = directions.addBands(sample_mean.select(6).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(2))).multiply(2));
    directions = directions.addBands(sample_mean.select(3).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(5))).multiply(3));
    directions = directions.addBands(sample_mean.select(0).subtract(sample_mean.select(4)).gt(sample_mean.select(4).subtract(sample_mean.select(8))).multiply(4));
    // The next 4 are the not() of the previous 4
    directions = directions.addBands(directions.select(0).not().multiply(5));
    directions = directions.addBands(directions.select(1).not().multiply(6));
    directions = directions.addBands(directions.select(2).not().multiply(7));
    directions = directions.addBands(directions.select(3).not().multiply(8));
  
    // Mask all values that are not 1-8
    directions = directions.updateMask(gradmask);
  
    // "collapse" the stack into a singe band image (due to masking, each pixel has just one value (1-8) in it's directional band, and is otherwise masked)
    directions = directions.reduce(ee.Reducer.sum());  
  
    //var pal = ['ffffff','ff0000','ffff00', '00ff00', '00ffff', '0000ff', 'ff00ff', '000000'];
    //Map.addLayer(directions.reduce(ee.Reducer.sum()), {min:1, max:8, palette: pal}, 'Directions', false);
  
    var sample_stats = sample_var.divide(sample_mean.multiply(sample_mean));
  
    // Calculate localNoiseVariance
    var sigmaV = sample_stats.toArray().arraySort().arraySlice(0,0,5).arrayReduce(ee.Reducer.mean(), [0]);
  
    // Set up the 7*7 kernels for directional statistics
    var rect_weights = ee.List.repeat(ee.List.repeat(0,7),3).cat(ee.List.repeat(ee.List.repeat(1,7),4));
  
    var diag_weights = ee.List([[1,0,0,0,0,0,0], [1,1,0,0,0,0,0], [1,1,1,0,0,0,0], 
      [1,1,1,1,0,0,0], [1,1,1,1,1,0,0], [1,1,1,1,1,1,0], [1,1,1,1,1,1,1]]);
  
    var rect_kernel = ee.Kernel.fixed(7,7, rect_weights, 3, 3, false);
    var diag_kernel = ee.Kernel.fixed(7,7, diag_weights, 3, 3, false);
  
    // Create stacks for mean and variance using the original kernels. Mask with relevant direction.
    var dir_mean = img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel).updateMask(directions.eq(1));
    var dir_var = img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel).updateMask(directions.eq(1));
  
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel).updateMask(directions.eq(2)));
    dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel).updateMask(directions.eq(2)));
  
    // and add the bands for rotated kernels
    for (var i=1; i<4; i++) {
      dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
      dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
      dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
      dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
    }
  
    // "collapse" the stack into a single band image (due to masking, each pixel has just one value in it's directional band, and is otherwise masked)
    dir_mean = dir_mean.reduce(ee.Reducer.sum());
    dir_var = dir_var.reduce(ee.Reducer.sum());
  
    // A finally generate the filtered value
    var varX = dir_var.subtract(dir_mean.multiply(dir_mean).multiply(sigmaV)).divide(sigmaV.add(1.0));
  
    var b = varX.divide(dir_var);
  
    return dir_mean.add(b.multiply(img.subtract(dir_mean)))
      .arrayProject([0])
      // Get a multi-band image bands.
      .arrayFlatten([['sum']])
      .float();
  })).toBands().rename(bandNames).copyProperties(image);
  return image.addBands(result, null, true) 
  } 

// GAMMA MAP filter 
exports.gammamap =  function(image) { 
    /** Gamma Maximum a-posterior Filter applied to one image. It is implemented as described in 
  Lopes A., Nezry, E., Touzi, R., and Laur, H., 1990.  Maximum A Posteriori Speckle Filtering and First Order texture Models in SAR Images.  
  International  Geoscience  and  Remote  Sensing  Symposium (IGARSS).  */
  var KERNEL_SIZE = 5;
  var enl = 5;
  var bandNames = image.bandNames().remove('angle');
  //Neighbourhood stats
  var reducers = ee.Reducer.mean().combine({
                reducer2: ee.Reducer.stdDev(),
                sharedInputs: true
                });
  var stats = image.select(bandNames).reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(KERNEL_SIZE/2,'pixels'), optimization: 'window'})
  var meanBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_mean')});
  var stdDevBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_stdDev')});
  
  var z = stats.select(meanBand);
  var sigz = stats.select(stdDevBand);
  
  // local observed coefficient of variation
  var ci = sigz.divide(z);
  // noise coefficient of variation (or noise sigma)
  var cu = 1.0/Math.sqrt(enl);
  // threshold for the observed coefficient of variation
  var cmax = Math.sqrt(2.0) * cu

  cu = ee.Image.constant(cu);
  cmax = ee.Image.constant(cmax);
  var enlImg = ee.Image.constant(enl);
  var oneImg = ee.Image.constant(1);
  var twoImg = ee.Image.constant(2);

  var alpha = oneImg.add(cu.pow(2)).divide(ci.pow(2).subtract(cu.pow(2)));

  //Implements the Gamma MAP filter described in equation 11 in Lopez et al. 1990
  var q = image.select(bandNames).expression("z**2 * (z * alpha - enl - 1)**2 + 4 * alpha * enl * b() * z", {z: z, alpha: alpha,enl: enl})
  var rHat = z.multiply(alpha.subtract(enlImg).subtract(oneImg)).add(q.sqrt()).divide(twoImg.multiply(alpha));

  //if ci <= cu then its a homogenous region ->> boxcar filter
  var zHat = (z.updateMask(ci.lte(cu))).rename(bandNames)
  //if cmax > ci > cu then its a textured medium ->> apply Gamma MAP filter
  rHat = (rHat.updateMask(ci.gt(cu)).updateMask(ci.lt(cmax))).rename(bandNames)
  //if ci>=cmax then its strong signal ->> retain
  var x = image.select(bandNames).updateMask(ci.gte(cmax)).rename(bandNames)

  // Merge
  var output = ee.ImageCollection([zHat,rHat,x]).sum();
  return image.addBands(output, null, true);
  }
  
// Improved Lee Sigma filter 
exports.leesigma = function(image) {
    /** Implements the improved lee sigma filter to one image. 
  It is implemented as described in, Lee, J.-S.; Wen, J.-H.; Ainsworth, T.L.; Chen, K.-S.; Chen, A.J. Improved sigma filter for speckle filtering of SAR imagery. 
  IEEE Trans. Geosci. Remote Sens. 2009, 47, 202–213. */
  //parameters
  var KERNEL_SIZE = 5;
  var Tk = ee.Image.constant(7); //number of bright pixels in a 3x3 window
  var sigma = 0.9;
  var enl = 4;
  var target_kernel = 3;
  var bandNames = image.bandNames().remove('angle');

  //compute the 98 percentile intensity 
  var z98 = image.select(bandNames).reduceRegion({
          reducer: ee.Reducer.percentile([98]),
          geometry: image.geometry(),
          scale:10,
          maxPixels:1e13
      }).toImage();
      
  //select the strong scatterers to retain
  var brightPixel = image.select(bandNames).gte(z98);
  var K = brightPixel.reduceNeighborhood({reducer: ee.Reducer.countDistinctNonNull()
                      ,kernel: ee.Kernel.square((target_kernel/2) ,'pixels')}); 
  var retainPixel = K.gte(Tk);


  //compute the a-priori mean within a 3x3 local window
  //original noise standard deviation
  var eta = 1.0/Math.sqrt(enl);
  eta = ee.Image.constant(eta);
  //MMSE applied to estimate the a-priori mean
  var reducers = ee.Reducer.mean().combine({
                reducer2: ee.Reducer.variance(),
                sharedInputs: true
                });
  var stats = image.select(bandNames).reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(target_kernel/2,'pixels'), optimization: 'window'})
  var meanBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_mean')});
  var varBand = bandNames.map(function(bandName){return ee.String(bandName).cat('_variance')});
  var z_bar = stats.select(meanBand);
  var varz = stats.select(varBand);
  
  var oneImg = ee.Image.constant(1);
  var varx = (varz.subtract(z_bar.abs().pow(2).multiply(eta.pow(2)))).divide(oneImg.add(eta.pow(2)));
  var b = varx.divide(varz);
  var xTilde = oneImg.subtract(b).multiply(z_bar.abs()).add(b.multiply(image.select(bandNames)));

  //step 3: compute the sigma range
  // Lookup table (J.S.Lee et al 2009) for range and eta values for intensity (only 4 look is shown here)
  var LUT = ee.Dictionary({0.5: ee.Dictionary({'I1': 0.694,'I2': 1.385,'eta': 0.1921}),
                           0.6: ee.Dictionary({'I1': 0.630,'I2': 1.495,'eta': 0.2348}),
                           0.7: ee.Dictionary({'I1': 0.560,'I2': 1.627,'eta': 0.2825}),
                           0.8: ee.Dictionary({'I1': 0.480,'I2': 1.804,'eta': 0.3354}),
                           0.9: ee.Dictionary({'I1': 0.378,'I2': 2.094,'eta': 0.3991}),
                           0.95: ee.Dictionary({'I1': 0.302,'I2': 2.360,'eta': 0.4391})});

  // extract data from lookup
  var sigmaImage = ee.Dictionary(LUT.get(String(sigma))).toImage();
  var I1 = sigmaImage.select('I1');
  var I2 = sigmaImage.select('I2');
  //new speckle sigma
  var nEta = sigmaImage.select('eta');
  //establish the sigma ranges
  I1 = I1.multiply(xTilde);
  I2 = I2.multiply(xTilde);

  //step 3: apply the minimum mean square error (MMSE) filter for pixels in the sigma range
  // MMSE estimator
  var mask = image.select(bandNames).gte(I1).or(image.select(bandNames).lte(I2));
  var z = image.select(bandNames).updateMask(mask);

  stats = z.reduceNeighborhood({reducer: reducers,kernel: ee.Kernel.square(KERNEL_SIZE/2,'pixels'), optimization: 'window'})

  z_bar = stats.select(meanBand);
  varz = stats.select(varBand);
  
  varx = (varz.subtract(z_bar.abs().pow(2).multiply(nEta.pow(2)))).divide(oneImg.add(nEta.pow(2)));
  b = varx.divide(varz);
  //if b is negative set it to zero
  var new_b = b.where(b.lt(0), 0);
  var xHat = oneImg.subtract(new_b).multiply(z_bar.abs()).add(new_b.multiply(z));

  // remove the applied masks and merge the retained pixels and the filtered pixels
  xHat = image.select(bandNames).updateMask(retainPixel).unmask(xHat);
  var output = ee.Image(xHat).rename(bandNames);
  return image.addBands(output, null, true);
} 

//---------------------------------------------------------------------------//
// Terrain Correction
//---------------------------------------------------------------------------//

//Terrain Flattening, (Volume Model) Implementation by Vollrath, A., Mullissa, A., & Reiche, J. (2020)
exports.slope_correction = function(image) {
  /* Vollrath, A., Mullissa, A., & Reiche, J. (2020). Angular-Based Radiometric Slope Correction for Sentinel-1 on Google Earth Engine. 
  Remote Sensing, 12(11), [1867]. https://doi.org/10.3390/rs12111867
  */
  var TERRAIN_FLATTENING_MODEL = 'VOLUME';
  var DEM = ee.Image('USGS/SRTMGL1_003');
  var TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER = 0;
  var ninetyRad = ee.Image.constant(90).multiply(Math.PI/180);

  var _volumetric_model_SCF = function(theta_iRad, alpha_rRad) {
    // Volume model
    var nominator = (ninetyRad.subtract(theta_iRad).add(alpha_rRad)).tan();
    var denominator = (ninetyRad.subtract(theta_iRad)).tan();
    return nominator.divide(denominator);
  }

  var _direct_model_SCF = function(theta_iRad, alpha_rRad, alpha_azRad) {
    // Surface model
    var nominator = (ninetyRad.subtract(theta_iRad)).cos();
    var denominator = alpha_azRad.cos()
      .multiply((ninetyRad.subtract(theta_iRad).add(alpha_rRad)).cos());
    return nominator.divide(denominator);
  }

  var _erode = function(image, distance)  {
    // buffer function (thanks Noel)
    var d = (image.not().unmask(1)
      .fastDistanceTransform(30).sqrt()
      .multiply(ee.Image.pixelArea().sqrt()));
    return image.updateMask(d.gt(distance));
  }
  
  var _masking = function(alpha_rRad, theta_iRad, buffer){
    // calculate masks
    // layover, where slope > radar viewing angle
    var layover = alpha_rRad.lt(theta_iRad).rename('layover');
    // shadow
    var shadow = alpha_rRad.gt(ee.Image.constant(-1).multiply(ninetyRad.subtract(theta_iRad))).rename('shadow');
    // combine layover and shadow
    var mask = layover.and(shadow);
    // add buffer to final mask
    if (buffer > 0)
      mask = _erode(mask, buffer);
    return mask.rename('no_data_mask');
  }

  var _correct = function(image) {
    var bandNames = image.bandNames();
    // get the image geometry and projection
    var geom = image.geometry()
    var proj = image.select(1).projection()
    
    var elevation = DEM.resample('bilinear').reproject({crs:proj, scale:10}).clip(geom)
    
    // calculate the look direction
    var heading = (ee.Terrain.aspect(image.select('angle'))
                                 .reduceRegion(ee.Reducer.mean(),image.geometry(),1000))
    
    // in case of null values for heading replace with 0
    heading = ee.Dictionary(heading).combine({aspect: 0}, false).get('aspect')

    heading = ee.Algorithms.If(
        ee.Number(heading).gt(180),
        ee.Number(heading).subtract(360),
        ee.Number(heading)
    )
    // the numbering follows the article chapters
    // 2.1.1 Radar geometry 
    var theta_iRad = image.select('angle').multiply(Math.PI/180)
    var phi_iRad = ee.Image.constant(heading).multiply(Math.PI/180)
    
    // 2.1.2 Terrain geometry
    //slope 
    var alpha_sRad = ee.Terrain.slope(elevation).select('slope').multiply(Math.PI / 180)

    // aspect (-180 to 180)
    var aspect = ee.Terrain.aspect(elevation).select('aspect').clip(geom)

    // we need to subtract 360 degree from all values above 180 degree
    var aspect_minus = aspect
      .updateMask(aspect.gt(180))
      .subtract(360)

    // we fill the aspect layer with the subtracted values from aspect_minus
    var phi_sRad = aspect
      .updateMask(aspect.lte(180))
      .unmask() 
      .add(aspect_minus.unmask()) //add the minus values
      .multiply(-1)   // make aspect uphill
      .multiply(Math.PI / 180) // make it rad
    
    // we get the height, for export 
    var height = DEM.reproject(proj).clip(geom)
    
    
    // 2.1.3 Model geometry
    //reduce to 3 angle
    var phi_rRad = phi_iRad.subtract(phi_sRad)

    // slope steepness in range (eq. 2)
    var alpha_rRad = (alpha_sRad.tan().multiply(phi_rRad.cos())).atan()

    // slope steepness in azimuth (eq 3)
    var alpha_azRad = (alpha_sRad.tan().multiply(phi_rRad.sin())).atan()

    // local incidence angle (eq. 4)
    var theta_liaRad = (alpha_azRad.cos().multiply((theta_iRad.subtract(alpha_rRad)).cos())).acos()
    var theta_liaDeg = theta_liaRad.multiply(180/Math.PI)

    // 2.2 
    // Gamma_nought
    var gamma0 = image.divide(theta_iRad.cos())

    if (TERRAIN_FLATTENING_MODEL == 'VOLUME') {
        // Volumetric Model
        var scf = _volumetric_model_SCF(theta_iRad, alpha_rRad)
    }
    
    if (TERRAIN_FLATTENING_MODEL == 'DIRECT') {
      var scf = _direct_model_SCF(theta_iRad, alpha_rRad, alpha_azRad)
    }
    // apply model for Gamm0
    var gamma0_flat = gamma0.multiply(scf)

    // get Layover/Shadow mask
    var mask = _masking(alpha_rRad, theta_iRad, TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER);

    var output = gamma0_flat.mask(mask).rename(bandNames).copyProperties(image);
    
    output = ee.Image(output).addBands(image.select('angle'),null,true);
  return output.set('system:time_start', image.get('system:time_start')); 
  }   
  return _correct(image)
}

//Layover and shadow mask based on Vollrath, A., Mullissa, A., & Reiche, J. (2020)
//adapted to use ALOS DSM
exports.addLayoverShadowMask = function(image) {
  var proj = image.select(1).projection()
  var DEM = ee.ImageCollection('JAXA/ALOS/AW3D30/V3_2').select('DSM').mosaic()
                             .setDefaultProjection(proj)

  //var DEM = ee.Image('USGS/SRTMGL1_003');
  var TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER = 10;
  var ninetyRad = ee.Image.constant(90).multiply(Math.PI/180);
  
  var _erode = function(image, distance)  {
    // buffer function (thanks Noel)
    var d = (image.not().unmask(1)
      .fastDistanceTransform(30).sqrt()
      .multiply(ee.Image.pixelArea().sqrt()));
    return image.updateMask(d.gt(distance));
  }
  
  var _masking = function(alpha_rRad, theta_iRad, buffer){
    // calculate masks
    // layover, where slope > radar viewing angle
    var layover = alpha_rRad.lt(theta_iRad).rename('layover');
    // shadow
    var shadow = alpha_rRad.gt(ee.Image.constant(-1).multiply(ninetyRad.subtract(theta_iRad))).rename('shadow');
    // combine layover and shadow
    var mask = layover.and(shadow);
    // add buffer to final mask
    if (buffer > 0)
      mask = _erode(mask, buffer);
    return mask.rename('no_data_mask');
  }

  var _correct = function(image) {
    var bandNames = image.bandNames();
    // get the image geometry and projection
    var geom = image.geometry()
    var proj = image.select(1).projection()
    
    var elevation = DEM.resample('bilinear').reproject({crs:proj, scale:10}).clip(geom)
    
    // calculate the look direction
    var heading = (ee.Terrain.aspect(image.select('angle'))
                                 .reduceRegion(ee.Reducer.mean(),image.geometry(),1000))
    
    // in case of null values for heading replace with 0
    heading = ee.Dictionary(heading).combine({aspect: 0}, false).get('aspect')

    heading = ee.Algorithms.If(
        ee.Number(heading).gt(180),
        ee.Number(heading).subtract(360),
        ee.Number(heading)
    )
    // the numbering follows the article chapters
    // 2.1.1 Radar geometry 
    var theta_iRad = image.select('angle').multiply(Math.PI/180)
    var phi_iRad = ee.Image.constant(heading).multiply(Math.PI/180)
    
    // 2.1.2 Terrain geometry
    //slope 
    var alpha_sRad = ee.Terrain.slope(elevation).select('slope').multiply(Math.PI / 180)

    // aspect (-180 to 180)
    var aspect = ee.Terrain.aspect(elevation).select('aspect').clip(geom)

    // we need to subtract 360 degree from all values above 180 degree
    var aspect_minus = aspect
      .updateMask(aspect.gt(180))
      .subtract(360)

    // we fill the aspect layer with the subtracted values from aspect_minus
    var phi_sRad = aspect
      .updateMask(aspect.lte(180))
      .unmask() 
      .add(aspect_minus.unmask()) //add the minus values
      .multiply(-1)   // make aspect uphill
      .multiply(Math.PI / 180) // make it rad
    
    // we get the height, for export 
    var height = DEM.reproject(proj).clip(geom)
    
    // 2.1.3 Model geometry
    //reduce to 3 angle
    var phi_rRad = phi_iRad.subtract(phi_sRad)

    // slope steepness in range (eq. 2)
    var alpha_rRad = (alpha_sRad.tan().multiply(phi_rRad.cos())).atan()

    // get Layover/Shadow mask
    var mask = _masking(alpha_rRad, theta_iRad, TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER);

    var output = image.mask(mask).rename(bandNames).copyProperties(image);
    
    output = ee.Image(output).addBands(image.select('angle'),null,true);
  return output.set('system:time_start', image.get('system:time_start')); 
  }   
  return _correct(image)
}

//---------------------------------------------------------------------------//
// Others
//---------------------------------------------------------------------------//

exports.addTemporalDevStats = function(image){
  // Yearly coll
  var date = ee.Date(image.get('system:time_start'));
  var start = date.advance(-182.5, 'day');
  var end =  date.advance(182.5, 'day');
  var yearlyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filter(ee.Filter.eq('instrumentMode', 'IW'));
  // reduce yearly imagecollection to n-th percentile image
  var p = [10, 30, 50, 70, 90];
  var VVperc = yearlyColl.select('VV').reduce(ee.Reducer.percentile(p));
  var VHperc = yearlyColl.select('VH').reduce(ee.Reducer.percentile(p));
  
  // Find deviation from weekly to yearly
  start = date.advance(-3.5, 'day');
  end =  date.advance(3.5, 'day');
  var weeklyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filter(ee.Filter.eq('instrumentMode', 'IW'));
  var VVwmean = weeklyColl.select('VV').reduce(ee.Reducer.mean()).select('VV_mean');
  var VHwmean = weeklyColl.select('VH').reduce(ee.Reducer.mean()).select('VH_mean');
  var VVw_p10 = VVwmean.subtract(VVperc.select('VV_p10')).rename('VVw_p10');
  var VHw_p10 = VHwmean.subtract(VHperc.select('VH_p10')).rename('VHw_p10');
  var VVw_p30 = VVwmean.subtract(VVperc.select('VV_p30')).rename('VVw_p30');
  //var VHw_p30 = VHwmean.subtract(VHperc.select('VH_p30')).rename('VHw_p30');
  var VVw_p50 = VHwmean.subtract(VVperc.select('VV_p50')).rename('VVw_p50');
  //var VHw_p50 = VHwmean.subtract(VHperc.select('VH_p50')).rename('VHw_p50');
  var VVw_p70 = VVwmean.subtract(VVperc.select('VV_p70')).rename('VVw_p70');
  //var VHw_p70 = VHwmean.subtract(VHperc.select('VH_p70')).rename('VHw_p70');
  var VVw_p90 = VVwmean.subtract(VVperc.select('VV_p90')).rename('VVw_p90');
  var VHw_p90 = VHwmean.subtract(VHperc.select('VH_p90')).rename('VHw_p90');
  
  // Find deviation from two-weekly to yearlyl
  start = date.advance(-7, 'day');
  end =  date.advance(7, 'day');
  var twoWeeklyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filter(ee.Filter.eq('instrumentMode', 'IW'));
  var VVtwmean = twoWeeklyColl.select('VV').reduce(ee.Reducer.mean()).select('VV_mean');
  var VHtwmean = twoWeeklyColl.select('VH').reduce(ee.Reducer.mean()).select('VH_mean');
  var VVtw_p10 = VVtwmean.subtract(VVperc.select('VV_p10')).rename('VVtw_p10');
  var VHtw_p10 = VHtwmean.subtract(VHperc.select('VH_p10')).rename('VHtw_p10');
  var VVtw_p30 = VVtwmean.subtract(VVperc.select('VV_p30')).rename('VVtw_p30');
  var VHtw_p30 = VHtwmean.subtract(VHperc.select('VH_p30')).rename('VHtw_p30');
  var VVtw_p50 = VVtwmean.subtract(VVperc.select('VV_p50')).rename('VVtw_p50');
  var VHtw_p50 = VHtwmean.subtract(VHperc.select('VH_p50')).rename('VHtw_p50');
  var VVtw_p70 = VVtwmean.subtract(VVperc.select('VV_p70')).rename('VVtw_p70');
  var VHtw_p70 = VHtwmean.subtract(VHperc.select('VH_p70')).rename('VHtw_p70');
  var VVtw_p90 = VVtwmean.subtract(VVperc.select('VV_p90')).rename('VVtw_p90');
  var VHtw_p90 = VHtwmean.subtract(VHperc.select('VH_p90')).rename('VHtw_p90');
  var list = [VVw_p10, VHw_p10, VVw_p30, VVw_p50, VVw_p70, VVw_p90, VHw_p90,
              VVtw_p10, VHtw_p10, VVtw_p30, VHtw_p30, VVtw_p50, VHtw_p50, VVtw_p70, VHtw_p70, VVtw_p90, VHtw_p90];
  return(image.addBands(list));
};

exports.addTemporalDevStatsScale60 = function(image){
  var image_og = image;
  image = genTools.scaleTo60m(image);
  // Yearly Coll
  var date = ee.Date(image.get('system:time_start'));
  var start = date.advance(-182.5, 'day');
  var end =  date.advance(182.5, 'day');
  var yearlyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filter(ee.Filter.eq('instrumentMode', 'IW'));
  // reduce yearly imagecollection to n-th percentile image
  var p = [10, 30, 50, 70, 90];
  var VVperc = yearlyColl.select('VV').reduce(ee.Reducer.percentile(p));
  var VHperc = yearlyColl.select('VH').reduce(ee.Reducer.percentile(p));
  
  // Find deviation from weekly to yearly
  start = date.advance(-3.5, 'day');
  end =  date.advance(3.5, 'day');
  var weeklyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filter(ee.Filter.eq('instrumentMode', 'IW'));
  var VVwmean = weeklyColl.select('VV').reduce(ee.Reducer.mean()).select('VV_mean');
  var VHwmean = weeklyColl.select('VH').reduce(ee.Reducer.mean()).select('VH_mean');
  var VVw_p10 = VVwmean.subtract(VVperc.select('VV_p10')).rename('VVw60_p10');
  var VHw_p10 = VHwmean.subtract(VHperc.select('VH_p10')).rename('VHw60_p10');
  var VVw_p30 = VVwmean.subtract(VVperc.select('VV_p30')).rename('VVw60_p30');
  //var VHw_p30 = VHwmean.subtract(VHperc.select('VH_p30')).rename('VHw60_p30');
  var VVw_p50 = VHwmean.subtract(VVperc.select('VV_p50')).rename('VVw60_p50');
  //var VHw_p50 = VHwmean.subtract(VHperc.select('VH_p50')).rename('VHw60_p50');
  var VVw_p70 = VVwmean.subtract(VVperc.select('VV_p70')).rename('VVw60_p70');
  //var VHw_p70 = VHwmean.subtract(VHperc.select('VH_p70')).rename('VHw60_p70');
  var VVw_p90 = VVwmean.subtract(VVperc.select('VV_p90')).rename('VVw60_p90');
  var VHw_p90 = VHwmean.subtract(VHperc.select('VH_p90')).rename('VHw60_p90');
  
  // Find deviation from two-weekly to yearly
  start = date.advance(-7, 'day');
  end =  date.advance(7, 'day');
  var twoWeeklyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    // Filter to get images collected in interferometric wide swath mode.
    .filter(ee.Filter.eq('instrumentMode', 'IW'));
  var VVtwmean = twoWeeklyColl.select('VV').reduce(ee.Reducer.mean()).select('VV_mean');
  var VHtwmean = twoWeeklyColl.select('VH').reduce(ee.Reducer.mean()).select('VH_mean');
  var VVtw_p10 = VVtwmean.subtract(VVperc.select('VV_p10')).rename('VVtw60_p10');
  var VHtw_p10 = VHtwmean.subtract(VHperc.select('VH_p10')).rename('VHtw60_p10');
  var VVtw_p30 = VVtwmean.subtract(VVperc.select('VV_p30')).rename('VVtw60_p30');
  var VHtw_p30 = VHtwmean.subtract(VHperc.select('VH_p30')).rename('VHtw60_p30');
  var VVtw_p50 = VVtwmean.subtract(VVperc.select('VV_p50')).rename('VVtw60_p50');
  var VHtw_p50 = VHtwmean.subtract(VHperc.select('VH_p50')).rename('VHtw60_p50');
  var VVtw_p70 = VVtwmean.subtract(VVperc.select('VV_p70')).rename('VVtw60_p70');
  var VHtw_p70 = VHtwmean.subtract(VHperc.select('VH_p70')).rename('VHtw60_p70');
  var VVtw_p90 = VVtwmean.subtract(VVperc.select('VV_p90')).rename('VVtw60_p90');
  var VHtw_p90 = VHtwmean.subtract(VHperc.select('VH_p90')).rename('VHtw60_p90');
  var list = [VVw_p10, VHw_p10, VVw_p30, VVw_p50, VVw_p70, VVw_p90, VHw_p90,
              VVtw_p10, VHtw_p10, VVtw_p30, VHtw_p30, VVtw_p50, VHtw_p50, VVtw_p70, VHtw_p70, VVtw_p90, VHtw_p90];
  return(image_og.addBands(list));
}

exports.addWeeklyStats = function(image){
  var date = ee.Date(image.get('system:time_start'));
  var start = date.advance(-3.5, 'day');
  var end =  date.advance(+3.5, 'day');
  var weeklyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .select('VV', 'VH');
  var w_median = weeklyColl.reduce(ee.Reducer.median());
  var VV_w_median = w_median.select('VV_median').rename('VV_w_median');
  var VH_w_median = w_median.select('VH_median').rename('VH_w_median');
  var w_mean = weeklyColl.reduce(ee.Reducer.mean());
  var VV_w_mean = w_mean.select('VV_mean').rename('VV_w_mean');
  var VH_w_mean = w_mean.select('VH_mean').rename('VH_w_mean');
  var w_min = weeklyColl.reduce(ee.Reducer.min());
  var VV_w_min = w_min.select('VV_min').rename('VV_w_min');
  var VH_w_min = w_min.select('VH_min').rename('VH_w_min');
  var w_max = weeklyColl.reduce(ee.Reducer.max());
  var VV_w_max = w_max.select('VV_max').rename('VV_w_max');
  var VH_w_max = w_max.select('VH_max').rename('VH_w_max');
  return(image.addBands([
    VV_w_median, VH_w_median, 
    VV_w_mean, VH_w_mean, 
    VV_w_max, VH_w_max, 
    VV_w_min, VH_w_min]));
};

exports.addWeeklyStats60 = function(image){
  var image_og = image;
  image = genTools.scaleTo60m(image);
  var date = ee.Date(image.get('system:time_start'));
  var start = date.advance(-3.5, 'day');
  var end =  date.advance(+3.5, 'day');
  var weeklyColl = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(start, end)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .select('VV', 'VH');
  var w_median = weeklyColl.reduce(ee.Reducer.median());
  var VV_w_median = w_median.select('VV_median').rename('VV60_w_median');
  var VH_w_median = w_median.select('VH_median').rename('VH60_w_median');
  var w_mean = weeklyColl.reduce(ee.Reducer.mean());
  var VV_w_mean = w_mean.select('VV_mean').rename('VV60_w_mean');
  var VH_w_mean = w_mean.select('VH_mean').rename('VH60_w_mean');
  var w_min = weeklyColl.reduce(ee.Reducer.min());
  var VV_w_min = w_min.select('VV_min').rename('VV60_w_min');
  var VH_w_min = w_min.select('VH_min').rename('VH60_w_min');
  var w_max = weeklyColl.reduce(ee.Reducer.max());
  var VV_w_max = w_max.select('VV_max').rename('VV60_w_max');
  var VH_w_max = w_max.select('VH_max').rename('VH60_w_max');
  return(image_og.addBands([
    VV_w_median, VH_w_median, 
    VV_w_mean, VH_w_mean, 
    VV_w_max, VH_w_max, 
    VV_w_min, VH_w_min]));
};

// Add VV to VH ratio (dB) to Image
exports.addVVVHRatioDB = function(image){
  // add VV to VH ratio in dB
  var VV = image.select('VV');
  var VH = image.select('VH');
  var VVVHratio = VV.subtract(VH); // VV/VH equals VV(db)-VH(db) due to logarithmic division law
  image = image.addBands(VVVHratio.rename('VVVHratio'));
  return(image);
};

// Add VH to VV ratio (dB) to Image
exports.addVHVVRatioDB = function(image){
  // add VV to VH ratio in dB
  var VV = image.select('VV');
  var VH = image.select('VH');
  var VHVVratio = VH.subtract(VV); // VV/VH equals VV(db)-VH(db) due to logarithmic division law
  image = image.addBands(VHVVratio.rename('VHVVratio'));
  return(image);
};

// Add Entropy and all GLCM textures (kernels: 3x3, 5x5, 6x6) to image
exports.addOptTexturesS1 = function(image){
  var image_int32 = image.select(['VV', 'VH']).multiply(ee.Image([1000, 1000])).cast({VH:'int32', VV:'int32'});
  // define kernels with pixel sizes of 3x3, 5x5, 7x7 (Note: kernels are defined in radii!)
  var sq3 = ee.Kernel.square({radius: 1});
  var sq5 = ee.Kernel.square({radius: 2});
  var sq7 = ee.Kernel.square({radius: 3});
  // add Entropy for VH band with window sizes: 3, 5 and 7
  var ent3_VH = image_int32.select('VH').entropy(sq3).rename('VH_ENTR_3x3');
  var ent5_VH = image_int32.select('VH').entropy(sq5).rename('VH_ENTR_5x5');
  var ent7_VH = image_int32.select('VH').entropy(sq7).rename('VH_ENTR_7x7');
  //image = image.addBands(ent3_VH);
  //image = image.addBands(ent5_VH);
  //image = image.addBands(ent7_VH);
  // add Entropy for VV band with window sizes: 3, 5 and 7
  var ent3_VV = image_int32.select('VV').entropy(sq3).rename('VV_ENTR_3x3');
  var ent5_VV = image_int32.select('VV').entropy(sq5).rename('VV_ENTR_5x5');
  var ent7_VV = image_int32.select('VV').entropy(sq7).rename('VV_ENTR_7x7');
  //image = image.addBands(ent3_VV);
  //image = image.addBands(ent5_VV);
  //image = image.addBands(ent7_VV);
  // add GLCM for VH with window sizes: 3, 5 and 7
  var glcm3_VH = image_int32.select('VH').glcmTexture({size: 1}).rename(['VH_asm_3x3', 'VH_contrast_3x3', 'VH_corr_3x3', 'VH_var_3x3', 'VH_idm_3x3', 'VH_savg_3x3', 'VH_svar_3x3', 'VH_sent_3x3', 'VH_ent_3x3', 'VH_dvar_3x3', 'VH_dent_3x3', 'VH_imcorr1_3x3', 'VH_imcorr2_3x3', 'VH_maxcorr_3x3', 'VH_diss_3x3', 'VH_inertia_3x3', 'VH_shade_3x3', 'VH_prom_3x3']);
  var glcm5_VH = image_int32.select('VH').glcmTexture({size: 2}).rename(['VH_asm_5x5', 'VH_contrast_5x5', 'VH_corr_5x5', 'VH_var_5x5', 'VH_idm_5x5', 'VH_savg_5x5', 'VH_svar_5x5', 'VH_sent_5x5', 'VH_ent_5x5', 'VH_dvar_5x5', 'VH_dent_5x5', 'VH_imcorr1_5x5', 'VH_imcorr2_5x5', 'VH_maxcorr_5x5', 'VH_diss_5x5', 'VH_inertia_5x5', 'VH_shade_5x5', 'VH_prom_5x5']);
  var glcm7_VH = image_int32.select('VH').glcmTexture({size: 3}).rename(['VH_asm_7x7', 'VH_contrast_7x7', 'VH_corr_7x7', 'VH_var_7x7', 'VH_idm_7x7', 'VH_savg_7x7', 'VH_svar_7x7', 'VH_sent_7x7', 'VH_ent_7x7', 'VH_dvar_7x7', 'VH_dent_7x7', 'VH_imcorr1_7x7', 'VH_imcorr2_7x7', 'VH_maxcorr_7x7', 'VH_diss_7x7', 'VH_inertia_7x7', 'VH_shade_7x7', 'VH_prom_7x7']);
  image = image.addBands(glcm3_VH.select(['VH_savg_3x3']));
  image = image.addBands(glcm5_VH.select(['VH_savg_5x5']));
  image = image.addBands(glcm7_VH.select(['VH_savg_7x7']));
  // add GLCM for VV with window sizes: 3, 5 and 7
  var glcm3_VV = image_int32.select('VV').glcmTexture({size: 1}).rename(['VV_asm_3x3', 'VV_contrast_3x3', 'VV_corr_3x3', 'VV_var_3x3', 'VV_idm_3x3', 'VV_savg_3x3', 'VV_svar_3x3', 'VV_sent_3x3', 'VV_ent_3x3', 'VV_dvar_3x3', 'VV_dent_3x3', 'VV_imcorr1_3x3', 'VV_imcorr2_3x3', 'VV_maxcorr_3x3', 'VV_diss_3x3', 'VV_inertia_3x3', 'VV_shade_3x3', 'VV_prom_3x3']);
  var glcm5_VV = image_int32.select('VV').glcmTexture({size: 2}).rename(['VV_asm_5x5', 'VV_contrast_5x5', 'VV_corr_5x5', 'VV_var_5x5', 'VV_idm_5x5', 'VV_savg_5x5', 'VV_svar_5x5', 'VV_sent_5x5', 'VV_ent_5x5', 'VV_dvar_5x5', 'VV_dent_5x5', 'VV_imcorr1_5x5', 'VV_imcorr2_5x5', 'VV_maxcorr_5x5', 'VV_diss_5x5', 'VV_inertia_5x5', 'VV_shade_5x5', 'VV_prom_5x5']);
  var glcm7_VV = image_int32.select('VV').glcmTexture({size: 3}).rename(['VV_asm_7x7', 'VV_contrast_7x7', 'VV_corr_7x7', 'VV_var_7x7', 'VV_idm_7x7', 'VV_savg_7x7', 'VV_svar_7x7', 'VV_sent_7x7', 'VV_ent_7x7', 'VV_dvar_7x7', 'VV_dent_7x7', 'VV_imcorr1_7x7', 'VV_imcorr2_7x7', 'VV_maxcorr_7x7', 'VV_diss_7x7', 'VV_inertia_7x7', 'VV_shade_7x7', 'VV_prom_7x7']);
  image = image.addBands(glcm3_VV.select(['VV_savg_3x3']));
  image = image.addBands(glcm5_VV.select(['VV_savg_5x5']));
  image = image.addBands(glcm7_VV.select(['VV_savg_7x7', 'VV_inertia_7x7', 'VV_contrast_7x7', 'VV_diss_7x7', 'VV_var_7x7']));
  return(image);
};

exports.addOptTemporalTexturesS1 = function(image){
  var image_int32 = image.select(['VVtw_p20', 'VHtw_p90']).multiply(ee.Image([1000, 1000])).cast({VHtw_p90:'int32', VVtw_p20:'int32'});
  // define kernels with pixel sizes of 3x3, 5x5, 7x7 (Note: kernels are defined in radii!)
  var sq3 = ee.Kernel.square({radius: 1});
  var sq5 = ee.Kernel.square({radius: 2});
  var sq7 = ee.Kernel.square({radius: 3});
  // add Entropy for VHtw_p90 band with window sizes: 3, 5 and 7
  var ent3_VH = image_int32.select('VHtw_p90').entropy(sq3).rename('VHtw_ENTR_3x3');
  var ent5_VH = image_int32.select('VHtw_p90').entropy(sq5).rename('VHtw_ENTR_5x5');
  var ent7_VH = image_int32.select('VHtw_p90').entropy(sq7).rename('VHtw_ENTR_7x7');
  //image = image.addBands(ent3_VH);
  //image = image.addBands(ent5_VH);
  //image = image.addBands(ent7_VH);
  // add Entropy for VVtw_p20 band with window sizes: 3, 5 and 7
  var ent3_VV = image_int32.select('VVtw_p20').entropy(sq3).rename('VVtw_ENTR_3x3');
  var ent5_VV = image_int32.select('VVtw_p20').entropy(sq5).rename('VVtw_ENTR_5x5');
  var ent7_VV = image_int32.select('VVtw_p20').entropy(sq7).rename('VVtw_ENTR_7x7');
  //image = image.addBands(ent3_VV);
  //image = image.addBands(ent5_VV);
  //image = image.addBands(ent7_VV);
  // add GLCM for VHtw_p90 with window sizes: 3, 5 and 7
  var glcm3_VH = image_int32.select('VHtw_p90').glcmTexture({size: 1}).rename(['VHtw_asm_3x3', 'VHtw_contrast_3x3', 'VHtw_corr_3x3', 'VHtw_var_3x3', 'VHtw_idm_3x3', 'VHtw_savg_3x3', 'VHtw_svar_3x3', 'VHtw_sent_3x3', 'VHtw_ent_3x3', 'VHtw_dvar_3x3', 'VHtw_dent_3x3', 'VHtw_imcorr1_3x3', 'VHtw_imcorr2_3x3', 'VHtw_maxcorr_3x3', 'VHtw_diss_3x3', 'VHtw_inertia_3x3', 'VHtw_shade_3x3', 'VHtw_prom_3x3']);
  var glcm5_VH = image_int32.select('VHtw_p90').glcmTexture({size: 2}).rename(['VHtw_asm_5x5', 'VHtw_contrast_5x5', 'VHtw_corr_5x5', 'VHtw_var_5x5', 'VHtw_idm_5x5', 'VHtw_savg_5x5', 'VHtw_svar_5x5', 'VHtw_sent_5x5', 'VHtw_ent_5x5', 'VHtw_dvar_5x5', 'VHtw_dent_5x5', 'VHtw_imcorr1_5x5', 'VHtw_imcorr2_5x5', 'VHtw_maxcorr_5x5', 'VHtw_diss_5x5', 'VHtw_inertia_5x5', 'VHtw_shade_5x5', 'VHtw_prom_5x5']);
  var glcm7_VH = image_int32.select('VHtw_p90').glcmTexture({size: 3}).rename(['VHtw_asm_7x7', 'VHtw_contrast_7x7', 'VHtw_corr_7x7', 'VHtw_var_7x7', 'VHtw_idm_7x7', 'VHtw_savg_7x7', 'VHtw_svar_7x7', 'VHtw_sent_7x7', 'VHtw_ent_7x7', 'VHtw_dvar_7x7', 'VHtw_dent_7x7', 'VHtw_imcorr1_7x7', 'VHtw_imcorr2_7x7', 'VHtw_maxcorr_7x7', 'VHtw_diss_7x7', 'VHtw_inertia_7x7', 'VHtw_shade_7x7', 'VHtw_prom_7x7']);
  image = image.addBands(glcm3_VH.select(['VHtw_savg_3x3']));
  image = image.addBands(glcm5_VH.select(['VHtw_savg_5x5']));
  image = image.addBands(glcm7_VH.select(['VHtw_savg_7x7']));
  // add GLCM for VVtw_p20 with window sizes: 3, 5 and 7
  var glcm3_VV = image_int32.select('VVtw_p20').glcmTexture({size: 1}).rename(['VVtw_asm_3x3', 'VVtw_contrast_3x3', 'VVtw_corr_3x3', 'VVtw_var_3x3', 'VVtw_idm_3x3', 'VVtw_savg_3x3', 'VVtw_svar_3x3', 'VVtw_sent_3x3', 'VVtw_ent_3x3', 'VVtw_dvar_3x3', 'VVtw_dent_3x3', 'VVtw_imcorr1_3x3', 'VVtw_imcorr2_3x3', 'VVtw_maxcorr_3x3', 'VVtw_diss_3x3', 'VVtw_inertia_3x3', 'VVtw_shade_3x3', 'VVtw_prom_3x3']);
  var glcm5_VV = image_int32.select('VVtw_p20').glcmTexture({size: 2}).rename(['VVtw_asm_5x5', 'VVtw_contrast_5x5', 'VVtw_corr_5x5', 'VVtw_var_5x5', 'VVtw_idm_5x5', 'VVtw_savg_5x5', 'VVtw_svar_5x5', 'VVtw_sent_5x5', 'VVtw_ent_5x5', 'VVtw_dvar_5x5', 'VVtw_dent_5x5', 'VVtw_imcorr1_5x5', 'VVtw_imcorr2_5x5', 'VVtw_maxcorr_5x5', 'VVtw_diss_5x5', 'VVtw_inertia_5x5', 'VVtw_shade_5x5', 'VVtw_prom_5x5']);
  var glcm7_VV = image_int32.select('VVtw_p20').glcmTexture({size: 3}).rename(['VVtw_asm_7x7', 'VVtw_contrast_7x7', 'VVtw_corr_7x7', 'VVtw_var_7x7', 'VVtw_idm_7x7', 'VVtw_savg_7x7', 'VVtw_svar_7x7', 'VVtw_sent_7x7', 'VVtw_ent_7x7', 'VVtw_dvar_7x7', 'VVtw_dent_7x7', 'VVtw_imcorr1_7x7', 'VVtw_imcorr2_7x7', 'VVtw_maxcorr_7x7', 'VVtw_diss_7x7', 'VVtw_inertia_7x7', 'VVtw_shade_7x7', 'VVtw_prom_7x7']);
  image = image.addBands(glcm3_VV.select(['VVtw_savg_3x3']));
  image = image.addBands(glcm5_VV.select(['VVtw_savg_5x5']));
  image = image.addBands(glcm7_VV.select(['VVtw_savg_7x7', 'VVtw_inertia_7x7', 'VVtw_contrast_7x7', 'VVtw_diss_7x7', 'VVtw_var_7x7']));
  return(image);
};

exports.plotCoverage = function(featurecollection){
  // Get proportion of covered lake and add it to images as property.
  var result_wratio = featurecollection.map(function(feature) {
    var covered = feature
    .eq(1)
    .selfMask()
    .reduceRegion({
      reducer: ee.Reducer.count(),
      //scale: 10,
      //tileScale: 1
    })
    .values()
    .get(0);
    var water = feature
    .eq(0)
    .selfMask()
    .reduceRegion({
      reducer: ee.Reducer.count(),
      //scale: 10,
      //tileScale: 1
    })
    .values()
    .get(0);
    // Save counts as numbers.
    var n_covered = ee.Number.parse(covered);
    var n_water = ee.Number.parse(water);
    var n_total = n_covered.add(n_water);
    var n_prop = n_covered.divide(n_total).multiply(100);
    var time = feature.get('system:time_start');
    var coverage = feature.get('coverage');
    // Create new feature with desired properties.
    var data = ee.Feature(null, {
      'proportion': n_prop,
      'sensor': 'S1',
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
  description:'export_S1_chartdata',
  folder: 'Earth Engine',
  fileNamePrefix: 'chart_S1',
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
};

// ADD ERA5 2m air temperature to image
exports.addDoy = function(img) {
  var year = ee.Date(img.get('system:time_start')).get('year').format();
  var doy = ee.Date(img.get('system:time_start')).getRelative('day', 'year').format();
  var yearAndDoy = ee.String(year.cat('-').cat(doy));
  return(img.set({'doy':yearAndDoy}));
};

// ADD ERA5 2m air temperature to image
exports.addPassDirS1 = function(img) {
  var pass = img.get('orbitProperties_pass');
  var n_pass = ee.Algorithms.If(ee.String(pass).compareTo('Ascending'), 0, 1);
  return(img.addBands(ee.Image.constant(n_pass).rename('pass')));
};

exports.exportCoverage = function(imagecoll){
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
    var data = ee.Feature(lake.centroid(10), {
      'proportion': n_prop,
      'sensor': 'S1',
      'coverage': coverage,
      'system:time_start': time,
      'date': ee.Date(time).format("yyyy-MM-dd")
    })
    return(data)
  });
  return(ee.FeatureCollection(result_wratio));
};

//---------------------------------------------------------------------------//
// Additional Border Noise Removal
//---------------------------------------------------------------------------//

/** (mask out angles >= 45) */
var maskAngLT45 = function(image) {
 var ang = image.select(['angle']);
 return image.updateMask(ang.lt(45)).set('system:time_start', image.get('system:time_start'));
};

/** Function to mask out edges of images using angle.
 * (mask out angles <= 31) */
var maskAngGT31 = function(image) {
 var ang = image.select(['angle']);
 return image.updateMask(ang.gt(31)).set('system:time_start', image.get('system:time_start'));
};

/** Mask edges. This function requires that the input image has one VH or VV band, and an 'angle' bands.  */
exports.f_mask_edges = function(image) {
  var output = maskAngGT31(image);
  output = maskAngLT45(output);
  return output.set('system:time_start', image.get('system:time_start'));
};
