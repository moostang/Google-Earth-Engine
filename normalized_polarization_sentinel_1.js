// -------------------------------------------------------------------------------
// This script calculates normalized polarization (Pol) from the bands VV and VH
// using the following formula:
//                VH - VV
//        VH_1 =  -------- 
//                VH + VV
// 
// The Pol is useful for discriminating between dry biomass and vegetated 
// structures (Patel et. al, 2006 Comparative evaluation of the sensitivity 
// of multi-polarized multi-frequency SAR backscatter to plant density. Int. 
// J. Remote Sens; Kornelsen et. all, 2013 Advances in soil moisture 
// retrieval from synthetic aperture radar and hydrological applications. J. 
// Hydrol.)
//
// 2019-11-25
// -------------------------------------------------------------------------------

// Define the geometry of the area bounding the project site
var geometry = ee.Geometry.Polygon(
  [[[-99.0071, 15.27205],
    [-99.0071, 15.07207],
    [-99.0016, 15.07207],
    [-99.0016, 15.27205]]]);

// Center Map to center of Project site
Map.centerObject(geometry,14);

// Make a collection of Sentinel-1 images containing the polarisations 
// along 'VV' and 'VH' for the given date. Also define the resolution.
var s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(geometry)
  .filterDate('2019-05-15', '2019-08-31')
  .filterMetadata('transmitterReceiverPolarisation', 'equals', ['VV', 'VH'])
  .filterMetadata('resolution_meters', 'equals', 10);
print(s1Collection);

// Create functions that will mask out the Sentinel-1 images beyond 
// 30 t0 45 degrees. 
var maskGTAng30 = function(image){
  var angle = image.select(['angle'])
  var maskedAngle = angle.gt(30)
  return image.updateMask(maskedAngle);
};
var s1Collection = s1Collection.map(maskGTAng30);

var maskLTAng45 = function(image){
  var angle = image.select(['angle'])
  var maskedAngle = angle.lt(45)
  return image.updateMask(maskedAngle);
};
var s1Collection = s1Collection.map(maskLTAng45);

print(s1Collection);

//Map.addLayer(s1Collection.select(['VV']).first().clip(geometry), {min:-30, max:0}, 'S-1 VV CORRECTED');

//.......
// ADD ADDITIONAL MASKS HERE such as temperature, wind, etc. 
//

// Convert sigma-0 to gamma-0
var toGamma0 = function(image) {
    var vh = image.select('VH').subtract(image.select('angle')
    .multiply(Math.PI/180.0).cos().log10().multiply(10.0));
    return vh.addBands(image.select('VV').subtract(image.select('angle')
    .multiply(Math.PI/180.0).cos().log10().multiply(10.0)));
}
var s1Collection = s1Collection.map(toGamma0);

// Calculate normalized difference between VH and VV
var normDiff = function(image){
  return image.addBands(image.expression( '(VH - VV) / (VH + VV)', 
  {
    'VH': image.select(['VH']),
    'VV': image.select(['VV'])
  }));
}; 

var s1Collection = s1Collection.map(normDiff);

// Applying normalized difference will result is a new band name 'VH_1'. 
// This will contain the normalized values which is between 0 to 1. 
var polVH = s1Collection.select(['VH_1'])

// Smooth output image by filtering 
var boxcar3by3 = ee.Kernel.circle({
  radius: 3,
  units: 'pixels',
  normalize: true
});

var meanFilter3by3 = function(image){
  return image.convolve(boxcar3by3);
};

var polVH = polVH.map(meanFilter3by3);
var polVH1 = polVH.mean();
Map.addLayer(polVH1.clip(geometry), {min:-0, max:0.5}, 'S-1 Filtered Polarized Boxcar Mean VH');

var polVH2 = polVH.median();
//Map.addLayer(polVH2.clip(geometry), {min:-30, max:1}, 'S-1 Filtered Polarized Boxcar Median VH');

